"""
Sauron In-Memory Log Buffer & State Management.
Stores debug events (dumps, SQL traces, tables, exceptions) for in-browser live streaming.
Supports active/pause recording toggles.
"""

from __future__ import annotations

import collections
import time
from typing import Any

MAX_LOGS = 300

# Global ring buffer of live debug logs
_log_buffer: collections.deque[dict[str, Any]] = collections.deque(maxlen=MAX_LOGS)
_is_recording_active: bool = True


def record_log(payload: dict[str, Any]) -> None:
	"""Record a log payload into the in-memory ring buffer if recording is active."""
	global _is_recording_active
	if not _is_recording_active:
		return

	# Ensure timestamp is set
	if "timestamp" not in payload or not payload["timestamp"]:
		payload["timestamp"] = time.time()

	_log_buffer.append(payload)


def get_logs(since_ts: float = 0.0, limit: int = 50) -> dict[str, Any]:
	"""
	Fetch logs newer than since_ts.
	Returns list of logs and current recording status.
	"""
	all_logs = list(_log_buffer)

	if since_ts > 0.0:
		filtered = [log for log in all_logs if log.get("timestamp", 0) > since_ts]
	else:
		filtered = all_logs[-limit:]

	latest_ts = filtered[-1]["timestamp"] if filtered else (all_logs[-1]["timestamp"] if all_logs else time.time())

	return {
		"is_recording": _is_recording_active,
		"total_in_buffer": len(all_logs),
		"logs": filtered,
		"latest_timestamp": latest_ts,
	}


def set_recording_state(active: bool) -> bool:
	"""Set the recording active / paused state."""
	global _is_recording_active
	_is_recording_active = bool(active)
	return _is_recording_active


def is_recording_active() -> bool:
	"""Get current recording active state."""
	return _is_recording_active


def clear_log_buffer() -> None:
	"""Clear all stored in-memory logs."""
	_log_buffer.clear()
