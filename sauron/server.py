"""
Sauron Server: Background HTTP receiver and Rich Terminal User Interface (TUI) renderer.
"""

from __future__ import annotations

import datetime
import http.server
import json
import os
import sys
import threading
from typing import Any

from rich.console import Console
from rich.panel import Panel
from rich.pretty import Pretty
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text
from rich.tree import Tree

console = Console()

COLOR_MAP = {
	"green": "bright_green",
	"red": "bright_red",
	"blue": "bright_blue",
	"yellow": "bright_yellow",
	"purple": "magenta",
	"orange": "dark_orange",
	"gray": "bright_black",
}


def _format_timestamp(ts: float | None = None) -> str:
	"""Format float timestamp into HH:MM:SS.mmm string."""
	dt = datetime.datetime.fromtimestamp(ts or datetime.datetime.now().timestamp())
	return dt.strftime("%H:%M:%S.%f")[:-3]


def _build_dict_tree(data: Any, root_name: str = "data") -> Tree:
	"""Recursively build a Rich Tree from nested dictionaries and lists."""
	tree = Tree(f"[bold cyan]{root_name}[/bold cyan]")

	def _add_nodes(parent_node: Tree, obj: Any) -> None:
		if isinstance(obj, dict):
			for k, v in obj.items():
				if isinstance(v, (dict, list)):
					branch = parent_node.add(f"[bold yellow]{k}[/bold yellow]")
					_add_nodes(branch, v)
				else:
					parent_node.add(f"[yellow]{k}[/yellow]: [green]{v!r}[/green]")
		elif isinstance(obj, list):
			for idx, item in enumerate(obj):
				if isinstance(item, (dict, list)):
					branch = parent_node.add(f"[dim]#{idx}[/dim]")
					_add_nodes(branch, item)
				else:
					parent_node.add(f"[dim]#{idx}[/dim] [green]{item!r}[/green]")
		else:
			parent_node.add(f"[green]{obj!r}[/green]")

	_add_nodes(tree, data)
	return tree


def render_payload(data: dict[str, Any]) -> None:
	"""Render incoming Sauron payload into the terminal using Rich components."""
	payload_type = data.get("type", "custom")

	if payload_type == "clear":
		console.clear()
		console.print("[dim italic]✨ Sauron console cleared[/dim italic]\n")
		return

	label = data.get("label")
	color_key = data.get("color") or "blue"
	border_color = COLOR_MAP.get(color_key, "bright_blue")
	origin = data.get("origin") or {}
	file_path = origin.get("file", "unknown")
	line_num = origin.get("line_number", 0)
	func_name = origin.get("function_name", "main")
	timestamp_str = _format_timestamp(data.get("timestamp"))

	# Create origin link (clickable in macOS Terminal & iTerm2)
	origin_display = f"{os.path.basename(file_path)}:{line_num} in {func_name}()"
	if file_path != "unknown":
		file_uri = f"file://{file_path}#L{line_num}"
		origin_display = f"[link={file_uri}][bold cyan]{os.path.basename(file_path)}:{line_num}[/bold cyan][/link] in [dim]{func_name}()[/dim]"

	header_text = Text()
	header_text.append(f"⏱  {timestamp_str}  •  ", style="dim")
	if label:
		header_text.append(f" {label} ", style=f"bold black on {border_color}")
		header_text.append("  •  ", style="dim")

	# Render body based on payload type
	content = data.get("content")

	if payload_type == "sql":
		query = content.get("query", "") if isinstance(content, dict) else str(content)
		duration = content.get("duration_ms") if isinstance(content, dict) else None
		duration_badge = f" [bold green]({duration} ms)[/bold green]" if duration is not None else ""

		body = Syntax(query, "sql", theme="monokai", line_numbers=False, word_wrap=True)
		title = f"🔍 SQL Query{duration_badge}  —  {origin_display}"

	elif payload_type == "table":
		table = Table(show_header=True, header_style="bold magenta", expand=True)
		rows = content.get("rows", []) if isinstance(content, dict) else content
		headers = content.get("headers") if isinstance(content, dict) else None

		if rows and isinstance(rows, list):
			first_row = rows[0]
			if isinstance(first_row, dict):
				col_names = headers or list(first_row.keys())
				for col in col_names:
					table.add_column(str(col), style="cyan")
				for r in rows:
					table.add_row(*[str(r.get(c, "")) for c in col_names])
			elif isinstance(first_row, (list, tuple)):
				col_names = headers or [f"Col {i+1}" for i in range(len(first_row))]
				for col in col_names:
					table.add_column(str(col), style="cyan")
				for r in rows:
					table.add_row(*[str(c) for c in r])
		body = table
		title = f"📊 Table Data  —  {origin_display}"

	elif payload_type == "measure":
		name = content.get("name", "Timer") if isinstance(content, dict) else "Timer"
		elapsed = content.get("elapsed_ms", 0.0) if isinstance(content, dict) else 0.0
		color_style = "bold green" if elapsed < 50 else ("bold yellow" if elapsed < 200 else "bold red")

		body = Text.from_markup(f"⏱  [bold white]{name}[/bold white] finished in [{color_style}]{elapsed:,.2f} ms[/{color_style}]")
		title = f"⚡ Benchmark  —  {origin_display}"

	elif payload_type == "exception":
		trace = content.get("traceback", "") if isinstance(content, dict) else str(content)
		body = Syntax(trace, "pytb", theme="monokai", line_numbers=False)
		title = f"🚨 Exception: {content.get('type', 'Error')}  —  {origin_display}"

	else:  # Custom dump
		if isinstance(content, (dict, list)):
			body = _build_dict_tree(content, root_name=label or "data")
		elif isinstance(content, str):
			# If looks like JSON string, try pretty printing
			try:
				parsed = json.loads(content)
				body = _build_dict_tree(parsed, root_name=label or "json")
			except Exception:
				body = Pretty(content)
		else:
			body = Pretty(content)
		title = f"👁  Sauron Dump  —  {origin_display}"

	panel = Panel(
		body,
		title=title,
		subtitle=header_text,
		border_style=border_color,
		expand=True,
		padding=(1, 2),
	)
	console.print(panel)


class SauronHTTPHandler(http.server.BaseHTTPRequestHandler):
	"""HTTP Request Handler to receive Sauron JSON payloads."""

	def do_OPTIONS(self) -> None:
		self.send_response(200)
		self._send_cors_headers()
		self.end_headers()

	def do_POST(self) -> None:
		try:
			content_length = int(self.headers.get("Content-Length", 0))
			raw_body = self.rfile.read(content_length)
			data = json.loads(raw_body.decode("utf-8"))
			render_payload(data)

			self.send_response(200)
			self._send_cors_headers()
			self.send_header("Content-Type", "application/json")
			self.end_headers()
			self.wfile.write(b'{"status":"ok"}')
		except Exception as e:
			self.send_response(400)
			self._send_cors_headers()
			self.end_headers()
			self.wfile.write(str(e).encode("utf-8"))

	def _send_cors_headers(self) -> None:
		self.send_header("Access-Control-Allow-Origin", "*")
		self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
		self.send_header("Access-Control-Allow-Headers", "Content-Type")

	def log_message(self, format: str, *args: Any) -> None:
		"""Suppress default HTTP access logs to keep terminal clean."""
		return


def start_server(host: str = "127.0.0.1", port: int = 7777) -> None:
	"""Start the Sauron HTTP listener daemon."""
	server_address = (host, port)
	try:
		httpd = http.server.ThreadingHTTPServer(server_address, SauronHTTPHandler)
	except OSError as e:
		console.print(f"[bold red]Failed to bind to {host}:{port}: {e}[/bold red]")
		sys.exit(1)

	console.print(
		Panel(
			f"[bold white]👁  SAURON WATCHER LISTENING[/bold white]\n"
			f"Host     : [bold cyan]{host}[/bold cyan]\n"
			f"Port     : [bold green]{port}[/bold green]\n"
			f"Endpoint : [underline]http://{host}:{port}/[/underline]\n\n"
			f"[dim]Press [bold white]Ctrl+C[/bold white] to stop watcher.[/dim]",
			border_style="magenta",
			expand=True,
		)
	)

	try:
		httpd.serve_forever()
	except KeyboardInterrupt:
		console.print("\n[bold yellow]Sauron Watcher stopped.[/bold yellow]")
	finally:
		httpd.server_close()
