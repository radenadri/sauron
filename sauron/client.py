"""
Sauron Client: Core client and dumper functionality.
Sends structured payloads to the Sauron Watcher daemon via HTTP.
"""

from __future__ import annotations

import contextlib
import inspect
import json
import os
import sys
import time
import urllib.request
import uuid
from typing import Any, Callable, Generator, Sequence

DEFAULT_HOST = os.environ.get("SAURON_HOST", "127.0.0.1")
DEFAULT_PORT = int(os.environ.get("SAURON_PORT", 7777))


def _json_serializable_fallback(obj: Any) -> Any:
	"""Serialize non-standard Python objects like Frappe Documents, Datetime, Decimals."""
	if hasattr(obj, "as_dict") and callable(getattr(obj, "as_dict")):
		return obj.as_dict()
	if hasattr(obj, "__dict__"):
		return obj.__dict__
	if hasattr(obj, "isoformat") and callable(getattr(obj, "isoformat")):
		return obj.isoformat()
	return str(obj)


def _get_caller_origin(skip_frames: int = 2) -> dict[str, Any]:
	"""Inspect call stack to retrieve caller file path, line number, and function name."""
	try:
		stack = inspect.stack()
		for frame_info in stack[skip_frames:]:
			filename = frame_info.filename
			if "sauron" not in filename or "test" in filename:
				return {
					"file": os.path.abspath(filename),
					"line_number": frame_info.lineno,
					"function_name": frame_info.function,
				}
		# Fallback if filtered
		frame = stack[min(skip_frames, len(stack) - 1)]
		return {
			"file": os.path.abspath(frame.filename),
			"line_number": frame.lineno,
			"function_name": frame.function,
		}
	except Exception:
		return {
			"file": "unknown",
			"line_number": 0,
			"function_name": "unknown",
		}


class SauronPayload:
	"""Payload container for a single Sauron debug event with chained formatting support."""

	def __init__(
		self,
		client: SauronClient,
		uuid_str: str,
		payload_type: str,
		content: Any,
		label: str | None = None,
		color: str | None = None,
		origin: dict[str, Any] | None = None,
	) -> None:
		self.client = client
		self.uuid = uuid_str
		self.payload_type = payload_type
		self.content = content
		self.label_text = label
		self.color_name = color
		self.origin = origin or _get_caller_origin(3)
		self._is_sent = False
		self._timer: Any = None
		self._schedule_send()

	def _schedule_send(self, delay: float = 0.005) -> None:
		import threading

		if self._is_sent:
			return
		if self._timer:
			self._timer.cancel()
		self._timer = threading.Timer(delay, self.send)
		self._timer.daemon = True
		self._timer.start()

	def send(self) -> SauronPayload:
		"""Transmit this payload to Sauron watcher daemon."""
		if self._timer:
			self._timer.cancel()
			self._timer = None
		self._is_sent = True

		data = {
			"uuid": self.uuid,
			"type": self.payload_type,
			"content": self.content,
			"label": self.label_text,
			"color": self.color_name,
			"origin": self.origin,
			"timestamp": time.time(),
		}
		self.client._send_json(data)
		return self

	def label(self, text: str) -> SauronPayload:
		"""Add or update label badge on the payload."""
		self.label_text = text
		self._schedule_send()
		return self

	def color(self, color_name: str) -> SauronPayload:
		"""Set border / tag color: green, red, blue, yellow, purple, orange, gray."""
		self.color_name = color_name.lower()
		self._schedule_send()
		return self

	def green(self) -> SauronPayload:
		return self.color("green")

	def red(self) -> SauronPayload:
		return self.color("red")

	def blue(self) -> SauronPayload:
		return self.color("blue")

	def yellow(self) -> SauronPayload:
		return self.color("yellow")

	def purple(self) -> SauronPayload:
		return self.color("purple")

	def gray(self) -> SauronPayload:
		return self.color("gray")


class SauronClient:
	"""Sauron Client instance controlling network dispatch and debug primitives."""

	def __init__(self, host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
		self.host = host
		self.port = port
		self.is_enabled = True

	@property
	def endpoint(self) -> str:
		return f"http://{self.host}:{self.port}/"

	def _send_json(self, data: dict[str, Any]) -> None:
		"""Send JSON payload via HTTP POST with 0.05s timeout. Fail-safe against connection errors."""
		if not self.is_enabled:
			return

		# Store in in-memory buffer for in-browser DevBar viewer
		try:
			from sauron.log_buffer import record_log
			record_log(data)
		except Exception:
			pass

		try:
			body = json.dumps(data, default=_json_serializable_fallback).encode("utf-8")
			req = urllib.request.Request(
				self.endpoint,
				data=body,
				headers={"Content-Type": "application/json", "User-Agent": "Sauron-Python-Client"},
				method="POST",
			)
			with urllib.request.urlopen(req, timeout=0.05):
				pass
		except Exception:
			# Silent fail-safe: never interrupt or slow down host application
			pass

	def __call__(self, *args: Any, **kwargs: Any) -> SauronPayload:
		"""Dump one or multiple variables to Sauron watcher."""
		origin = _get_caller_origin(2)
		val: Any = args[0] if len(args) == 1 else list(args)
		label = kwargs.get("label")
		color = kwargs.get("color")

		payload = SauronPayload(
			client=self,
			uuid_str=str(uuid.uuid4()),
			payload_type="custom",
			content=val,
			label=label,
			color=color,
			origin=origin,
		)
		return payload.send()

	def table(
		self,
		rows: Sequence[dict[str, Any] | Sequence[Any]],
		headers: Sequence[str] | None = None,
		label: str | None = "Table",
		color: str | None = "blue",
	) -> SauronPayload:
		"""Render tabular data in Rich table format."""
		origin = _get_caller_origin(2)
		payload = SauronPayload(
			client=self,
			uuid_str=str(uuid.uuid4()),
			payload_type="table",
			content={"rows": rows, "headers": headers},
			label=label,
			color=color,
			origin=origin,
		)
		return payload.send()

	def sql(
		self,
		query: str,
		duration_ms: float | None = None,
		label: str = "SQL Query",
		color: str = "purple",
	) -> SauronPayload:
		"""Render SQL query with syntax highlighting and optional execution time."""
		origin = _get_caller_origin(2)
		payload = SauronPayload(
			client=self,
			uuid_str=str(uuid.uuid4()),
			payload_type="sql",
			content={"query": str(query).strip(), "duration_ms": duration_ms},
			label=label,
			color=color,
			origin=origin,
		)
		return payload.send()

	def exception(self, exc: BaseException, label: str = "Exception") -> SauronPayload:
		"""Capture and display an exception traceback."""
		import traceback

		origin = _get_caller_origin(2)
		payload = SauronPayload(
			client=self,
			uuid_str=str(uuid.uuid4()),
			payload_type="exception",
			content={
				"type": type(exc).__name__,
				"message": str(exc),
				"traceback": "".join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
			},
			label=label,
			color="red",
			origin=origin,
		)
		return payload.send()

	@contextlib.contextmanager
	def measure(self, name: str = "Execution Time") -> Generator[None, None, None]:
		"""Context manager stopwatch to measure execution duration of a block of code."""
		origin = _get_caller_origin(3)
		start_time = time.perf_counter()
		try:
			yield
		finally:
			elapsed_ms = (time.perf_counter() - start_time) * 1000.0
			payload = SauronPayload(
				client=self,
				uuid_str=str(uuid.uuid4()),
				payload_type="measure",
				content={"name": name, "elapsed_ms": round(elapsed_ms, 2)},
				label=f"Timer: {name}",
				color="green" if elapsed_ms < 50 else ("yellow" if elapsed_ms < 200 else "red"),
				origin=origin,
			)
			payload.send()

	def clear(self) -> None:
		"""Clear the watcher terminal screen."""
		self._send_json({"type": "clear", "timestamp": time.time()})

	def dd(self, *args: Any) -> None:
		"""Dump variables to Sauron and terminate execution (Die and Dump)."""
		self(*args).red().label("Dump & Die (dd)")
		sys.exit(1)

	def die(self, *args: Any) -> None:
		self.dd(*args)
