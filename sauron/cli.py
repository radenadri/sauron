"""
Sauron CLI: Click command-line interface for running the watcher and utilities.
"""

from __future__ import annotations

import os
import sys
import time
import click

from sauron.client import DEFAULT_HOST, DEFAULT_PORT, SauronClient
from sauron.server import start_server


@click.group()
@click.version_option(version="0.1.0", prog_name="sauron")
def main() -> None:
	"""👁  Sauron: Terminal-based Real-time Debugger for Frappe & Python."""
	pass


@main.command(name="watch")
@click.option("--host", "-h", default=DEFAULT_HOST, help="Host interface to bind to.")
@click.option("--port", "-p", default=DEFAULT_PORT, type=int, help="Port to listen on (default: 7777).")
def watch(host: str, port: int) -> None:
	"""Start real-time terminal watcher to capture debug logs."""
	start_server(host=host, port=port)


@main.command(name="clear")
@click.option("--host", "-h", default=DEFAULT_HOST, help="Target Sauron host.")
@click.option("--port", "-p", default=DEFAULT_PORT, type=int, help="Target Sauron port.")
def clear(host: str, port: int) -> None:
	"""Clear the active Sauron watch terminal."""
	client = SauronClient(host=host, port=port)
	client.clear()
	click.echo(f"Sent clear command to Sauron at http://{host}:{port}/")


@main.command(name="test")
@click.option("--host", "-h", default=DEFAULT_HOST, help="Target Sauron host.")
@click.option("--port", "-p", default=DEFAULT_PORT, type=int, help="Target Sauron port.")
def test(host: str, port: int) -> None:
	"""Send sample debug events to verify Sauron watcher rendering."""
	client = SauronClient(host=host, port=port)
	click.echo(f"Sending test payloads to http://{host}:{port}/ ...")

	# 1. Simple string dump
	client("Hello Sauron from CLI Test!").green().label("Greetings")
	time.sleep(0.1)

	# 2. Complex dictionary
	client(
		{
			"project": "Brightside ERPNext",
			"site": "brightside.local",
			"active_apps": ["frappe", "erpnext", "bns_rental_management", "sauron"],
			"developer_mode": 1,
			"environment": {
				"python": "3.14.0rc3",
				"port": 8888,
			},
		}
	).blue().label("Environment Context")
	time.sleep(0.1)

	# 3. SQL Query
	client.sql(
		"SELECT item_code, item_name, standard_rate FROM `tabItem` WHERE disabled = 0 ORDER BY modified DESC LIMIT 5;",
		duration_ms=4.85,
		label="DB Query Tracing",
	)
	time.sleep(0.1)

	# 4. Table data
	client.table(
		[
			{"item_code": "EXC-001", "item_name": "Excavator 20T", "daily_rate": 3500000, "status": "Available"},
			{"item_code": "GEN-100", "item_name": "Diesel Generator 100kVA", "daily_rate": 1200000, "status": "Rented"},
			{"item_code": "CRN-050", "item_name": "Mobile Crane 50T", "daily_rate": 7500000, "status": "Available"},
		],
		label="Rental Fleet Status",
		color="purple",
	)
	time.sleep(0.1)

	# 5. Measure timer
	with client.measure("API Processing Benchmark"):
		time.sleep(0.045)

	click.echo("✓ Test payloads dispatched successfully.")


if __name__ == "__main__":
	main()
