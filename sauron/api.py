"""
Sauron Developer Experience (DX) Backend APIs.
Provides endpoints for Fast User Impersonation, DocType Code Jump, and Live SQL & N+1 Query Profiling.
Guarded strictly by developer_mode.
"""

from __future__ import annotations

import os
import subprocess
import sys
import threading
import time
from typing import Any

import frappe
from frappe import _
import sauron
from sauron.query_tracer import clear_query_buffer, get_profiled_queries


@frappe.whitelist(allow_guest=True)
def get_devbar_context() -> dict[str, Any]:
	"""
	Get context for Sauron DevBar:
	- Current user and role profile
	- List of switchable users
	- Site name, developer_mode, and installed apps
	"""
	if not is_dev_mode_allowed():
		return {"enabled": False, "reason": "Developer mode is disabled"}

	# Fetch list of active users with their full names and roles
	users = frappe.get_all(
		"User",
		filters={"enabled": 1, "user_type": "System User"},
		fields=["name", "full_name", "user_image"],
		order_by="creation asc",
		limit=20,
	)

	for u in users:
		u["roles"] = frappe.get_roles(u["name"])

	return {
		"enabled": True,
		"current_user": frappe.session.user,
		"current_user_roles": frappe.get_roles(),
		"users": users,
		"site": frappe.local.site,
		"developer_mode": frappe.conf.developer_mode or 0,
		"installed_apps": frappe.get_installed_apps(),
	}


@frappe.whitelist()
def switch_user(user: str) -> dict[str, Any]:
	"""
	Fast Impersonation: Instantly switch session to the target user without password.
	Strictly allowed only when developer_mode == 1.
	"""
	if not is_dev_mode_allowed():
		frappe.throw(_("User switching is only permitted in Developer Mode."), frappe.PermissionError)

	if not frappe.db.exists("User", user):
		frappe.throw(_("User {0} does not exist.").format(user))

	# Update session user
	frappe.set_user(user)

	# Update user session cookie and cache
	frappe.local.session_obj.user = user
	frappe.local.session_obj.update()

	return {
		"success": True,
		"user": user,
		"roles": frappe.get_roles(user),
	}


@frappe.whitelist()
def get_doctype_source(doctype: str) -> dict[str, Any]:
	"""
	Resolve local filesystem source paths for a DocType (.py, .js, .json).
	Returns Zed/Cursor/VSCode deep links for 1-click code jump.
	"""
	if not doctype or not frappe.db.exists("DocType", doctype):
		return {"found": False}

	doc = frappe.get_doc("DocType", doctype)
	module = doc.module
	module_path = frappe.get_module_path(module)
	doctype_folder_name = frappe.scrub(doctype)
	
	base_path = os.path.join(module_path, "doctype", doctype_folder_name)
	
	py_file = os.path.join(base_path, f"{doctype_folder_name}.py")
	js_file = os.path.join(base_path, f"{doctype_folder_name}.js")
	json_file = os.path.join(base_path, f"{doctype_folder_name}.json")

	return {
		"found": True,
		"doctype": doctype,
		"module": module,
		"base_path": base_path,
		"files": {
			"py": {
				"path": py_file,
				"exists": os.path.exists(py_file),
				"vscode_url": f"vscode://file{py_file}",
				"cursor_url": f"cursor://file{py_file}",
				"zed_url": f"zed://file{py_file}",
			},
			"js": {
				"path": js_file,
				"exists": os.path.exists(js_file),
				"vscode_url": f"vscode://file{js_file}",
				"cursor_url": f"cursor://file{js_file}",
				"zed_url": f"zed://file{js_file}",
			},
			"json": {
				"path": json_file,
				"exists": os.path.exists(json_file),
				"vscode_url": f"vscode://file{json_file}",
				"cursor_url": f"cursor://file{json_file}",
				"zed_url": f"zed://file{json_file}",
			},
		},
	}


@frappe.whitelist()
def get_live_sql_stats(limit: int = 50) -> dict[str, Any]:
	"""
	Get live database query profiling data and N+1 pattern detection.
	"""
	if not is_dev_mode_allowed():
		return {"total_queries": 0, "queries": []}

	frappe.local._in_sauron_tracer = True
	try:
		return get_profiled_queries(limit=int(limit))
	finally:
		frappe.local._in_sauron_tracer = False


@frappe.whitelist()
def dump_queries_to_terminal() -> dict[str, Any]:
	"""
	Dump recent SQL queries and N+1 analysis to the Sauron terminal watcher.
	"""
	if not is_dev_mode_allowed():
		return {"success": False}

	data = get_profiled_queries(limit=30)
	
	# Transmit summary to Sauron Terminal Watcher
	if data["n_plus_one_groups"]:
		sauron.table(
			[
				{
					"Repeats": g["count"],
					"Total ms": f"{g['total_ms']}ms",
					"Caller": g["caller"],
					"Sample Query": g["sample_query"][:60] + "...",
				}
				for g in data["n_plus_one_groups"]
			],
			label=f"N+1 Warnings ({len(data['n_plus_one_groups'])} duplicate patterns)",
			color="red",
		)

	# Dump raw query list
	sauron.table(
		[
			{
				"ms": f"{q['duration_ms']}ms",
				"N+1": "YES" if q["is_n_plus_one"] else "no",
				"Caller": q["caller"],
				"Query": q["query"][:70] + ("..." if len(q["query"]) > 70 else ""),
			}
			for q in data["queries"][:20]
		],
		label=f"SQL Trace ({data['total_queries']} queries, {data['total_duration_ms']}ms total)",
		color="blue",
	)

	return {"success": True, "count": data["total_queries"]}


@frappe.whitelist()
def clear_sql_buffer() -> dict[str, Any]:
	"""Clear the query tracer ring buffer."""
	clear_query_buffer()
	return {"success": True}


@frappe.whitelist()
def get_live_logs(since_ts: float = 0.0, limit: int = 50) -> dict[str, Any]:
	"""
	Fetch live Sauron debug logs for in-browser streaming viewer.
	"""
	if not is_dev_mode_allowed():
		return {"is_recording": False, "logs": [], "latest_timestamp": 0.0}

	from sauron.log_buffer import get_logs
	return get_logs(since_ts=float(since_ts or 0.0), limit=int(limit or 50))


@frappe.whitelist()
def toggle_log_recording(active: int | bool = 1) -> dict[str, Any]:
	"""
	Toggle active / paused recording of debug logs.
	"""
	if not is_dev_mode_allowed():
		return {"is_recording": False}

	from sauron.log_buffer import set_recording_state
	new_state = set_recording_state(bool(int(active)))
	return {"is_recording": new_state}


@frappe.whitelist()
def clear_live_logs() -> dict[str, Any]:
	"""Clear all live in-memory logs."""
	from sauron.log_buffer import clear_log_buffer
	clear_log_buffer()
	return {"success": True}


@frappe.whitelist()
def push_browser_log(payload: str | dict[str, Any]) -> dict[str, Any]:
	"""
	Push browser-generated dump into Sauron in-memory buffer.
	"""
	import json
	if isinstance(payload, str):
		payload = json.loads(payload)

	from sauron.log_buffer import record_log
	record_log(payload)
	return {"success": True}


# Thread-safe migration state tracker
_migration_lock = threading.Lock()
_migration_state = {
	"is_running": False,
	"site": "",
	"started_at": 0.0,
	"returncode": None,
	"last_line": "",
}


def _run_migration_worker(site: str) -> None:
	"""
	Worker thread running bench migrate in a background subprocess.
	Streams stdout/stderr line-by-line to Sauron In-Desk Log Buffer and Terminal Watcher.
	"""
	global _migration_state
	from sauron.log_buffer import record_log

	bench_path = frappe.utils.get_bench_path()
	sites_dir = os.path.join(bench_path, "sites")

	cmd = [sys.executable, "-m", "frappe.utils.bench_helper", "frappe", "--site", site, "migrate"]

	record_log({
		"type": "custom",
		"label": "Migrate",
		"color": "yellow",
		"content": f"🚀 Starting 'bench --site {site} migrate'...",
		"origin": {"file": "sauron.api", "line_number": 0, "function_name": "run_bench_migrate"},
		"timestamp": time.time(),
	})
	sauron(f"🚀 Starting 'bench --site {site} migrate'...").yellow().label("Migrate")

	try:
		env = os.environ.copy()
		env["PYTHONUNBUFFERED"] = "1"

		proc = subprocess.Popen(
			cmd,
			cwd=sites_dir,
			stdout=subprocess.PIPE,
			stderr=subprocess.STDOUT,
			text=True,
			bufsize=1,
			env=env,
		)

		if proc.stdout:
			for raw_line in proc.stdout:
				line = raw_line.strip()
				if not line:
					continue

				_migration_state["last_line"] = line

				# Determine card badge color based on log message
				color = "blue"
				lowered = line.lower()
				if "error" in lowered or "fail" in lowered or "traceback" in lowered:
					color = "red"
				elif "executing" in lowered or "syncing" in lowered or "migrating" in lowered:
					color = "purple"
				elif "success" in lowered or "done" in lowered or "completed" in lowered:
					color = "green"

				record_log({
					"type": "custom",
					"label": "Migrate",
					"color": color,
					"content": line,
					"origin": {"file": "sauron.api", "line_number": 0, "function_name": "bench_helper"},
					"timestamp": time.time(),
				})
				sauron(line).color(color).label("Migrate")

		proc.wait()
		returncode = proc.returncode

		with _migration_lock:
			_migration_state["is_running"] = False
			_migration_state["returncode"] = returncode

		if returncode == 0:
			msg = f"✓ Migration for {site} completed successfully."
			record_log({
				"type": "custom",
				"label": "Migrate Done",
				"color": "green",
				"content": msg,
				"origin": {"file": "sauron.api", "line_number": 0, "function_name": "run_bench_migrate"},
				"timestamp": time.time(),
			})
			sauron(msg).green().label("Migrate Done")
		else:
			msg = f"✗ Migration for {site} failed with exit code {returncode}."
			record_log({
				"type": "custom",
				"label": "Migrate Error",
				"color": "red",
				"content": msg,
				"origin": {"file": "sauron.api", "line_number": 0, "function_name": "run_bench_migrate"},
				"timestamp": time.time(),
			})
			sauron(msg).red().label("Migrate Error")

	except Exception as e:
		with _migration_lock:
			_migration_state["is_running"] = False
			_migration_state["returncode"] = -1
			_migration_state["last_line"] = str(e)

		err_msg = f"Exception during migration: {e}"
		record_log({
			"type": "exception",
			"label": "Migrate Error",
			"color": "red",
			"content": {"type": type(e).__name__, "message": str(e), "traceback": ""},
			"origin": {"file": "sauron.api", "line_number": 0, "function_name": "run_bench_migrate"},
			"timestamp": time.time(),
		})
		sauron(err_msg).red().label("Migrate Exception")


@frappe.whitelist()
def clear_bench_cache() -> dict[str, Any]:
	"""
	Clear Redis cache, doctype cache, and website cache.
	Strictly allowed only when developer_mode == 1.
	"""
	if not is_dev_mode_allowed():
		frappe.throw(_("Clear cache via DevBar is only allowed in Developer Mode."), frappe.PermissionError)

	from frappe.website.utils import clear_website_cache

	frappe.clear_cache()
	clear_website_cache()

	# Also log to Sauron
	sauron({"action": "clear_cache", "site": frappe.local.site}).green().label("Bench Cache Cleared")

	return {
		"success": True,
		"site": frappe.local.site,
		"message": _("Cache cleared successfully for site: {0}").format(frappe.local.site),
	}


@frappe.whitelist()
def run_bench_migrate() -> dict[str, Any]:
	"""
	Trigger bench migrate for the active site in a background thread.
	Strictly allowed only when developer_mode == 1.
	"""
	if not is_dev_mode_allowed():
		frappe.throw(_("Migration via DevBar is only allowed in Developer Mode."), frappe.PermissionError)

	global _migration_state
	site = frappe.local.site

	with _migration_lock:
		if _migration_state["is_running"]:
			return {
				"started": False,
				"is_running": True,
				"site": _migration_state["site"],
				"message": _("Migration is already in progress for site: {0}").format(_migration_state["site"]),
			}

		_migration_state["is_running"] = True
		_migration_state["site"] = site
		_migration_state["started_at"] = time.time()
		_migration_state["returncode"] = None
		_migration_state["last_line"] = "Starting migration process..."

	thread = threading.Thread(target=_run_migration_worker, args=(site,), daemon=True)
	thread.start()

	return {
		"started": True,
		"is_running": True,
		"site": site,
		"message": _("Migration started in background for site: {0}").format(site),
	}


@frappe.whitelist()
def get_migrate_status() -> dict[str, Any]:
	"""
	Get current status of background migration.
	"""
	if not is_dev_mode_allowed():
		return {"is_running": False}

	with _migration_lock:
		elapsed = round(time.time() - _migration_state["started_at"], 1) if _migration_state["is_running"] else 0.0
		return {
			"is_running": _migration_state["is_running"],
			"site": _migration_state["site"],
			"elapsed_seconds": elapsed,
			"returncode": _migration_state["returncode"],
			"last_line": _migration_state["last_line"],
		}


def is_dev_mode_allowed() -> bool:
	"""Verify that developer mode is active on the current site."""
	return bool(frappe.conf.developer_mode or frappe.local.dev_server)

