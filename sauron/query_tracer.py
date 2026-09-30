"""
Sauron Live SQL & N+1 Query Tracer for Frappe Framework.
Intercepts database executions during developer mode to profile latency,
track query counts, and automatically flag N+1 query patterns.
"""

from __future__ import annotations

import collections
import re
import time
import traceback
from typing import Any

import frappe

# Maximum number of queries retained in local ring buffer
MAX_BUFFERED_QUERIES = 200

# Global ring buffer of recent queries (thread-safe deque)
_query_buffer: collections.deque[dict[str, Any]] = collections.deque(maxlen=MAX_BUFFERED_QUERIES)
_is_tracer_hooked = False


def hook_database_tracer() -> None:
	"""Hook into Frappe's Database class to track query latency and caller context."""
	global _is_tracer_hooked
	if _is_tracer_hooked:
		return

	try:
		from frappe.database.database import Database

		original_sql = Database.sql

		def traced_sql(self, query, *args, **kwargs):
			# Skip tracking if not in developer mode or during internal tracer calls
			if not getattr(frappe.conf, "developer_mode", False) or getattr(frappe.local, "_in_sauron_tracer", False):
				return original_sql(self, query, *args, **kwargs)

			start_time = time.perf_counter()
			try:
				return original_sql(self, query, *args, **kwargs)
			finally:
				duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
				record_query(str(query), duration_ms)

		Database.sql = traced_sql
		_is_tracer_hooked = True
	except Exception:
		# Fail-safe: do not crash if hooking fails
		pass


def record_query(query_str: str, duration_ms: float) -> None:
	"""Record an executed query with caller context into the ring buffer."""
	if not query_str:
		return

	# Normalize whitespace
	clean_query = " ".join(query_str.split())
	
	# Skip internal trace/session noise if needed
	if "FRAPPE_TRACE_ID" in clean_query and "sauron" in clean_query:
		return

	# Extract caller origin (outside frappe.database and sauron)
	caller = "Desk / System"
	for frame in traceback.extract_stack():
		filename = frame.filename
		if "frappe/database" not in filename and "sauron/query_tracer" not in filename and "sauron/api" not in filename:
			caller = f"{frame.name} ({filename.split('/')[-1]}:{frame.lineno})"

	# Simplified query pattern for N+1 detection (strip literal IDs/quotes)
	pattern = re.sub(r"'[^']*'", "'?'", clean_query)
	pattern = re.sub(r"\b\d+\b", "?", pattern)

	entry = {
		"query": clean_query,
		"pattern": pattern,
		"duration_ms": duration_ms,
		"caller": caller,
		"timestamp": time.time(),
	}

	_query_buffer.append(entry)


def get_profiled_queries(limit: int = 50) -> dict[str, Any]:
	"""
	Analyze buffered queries:
	- Calculate total query count and total DB latency
	- Identify slow queries (> 30ms)
	- Group and flag N+1 query patterns
	"""
	queries = list(_query_buffer)[-limit:]
	queries.reverse()  # Newest first

	if not queries:
		return {
			"total_queries": 0,
			"total_duration_ms": 0.0,
			"slow_queries_count": 0,
			"n_plus_one_count": 0,
			"queries": [],
			"n_plus_one_groups": [],
		}

	total_duration = round(sum(q["duration_ms"] for q in queries), 2)
	slow_queries = [q for q in queries if q["duration_ms"] >= 30.0]

	# Group by pattern for N+1 detection
	pattern_counts: dict[str, list[dict[str, Any]]] = collections.defaultdict(list)
	for q in queries:
		pattern_counts[q["pattern"]].append(q)

	n_plus_one_groups = []
	for pattern, group in pattern_counts.items():
		if len(group) >= 2 and not pattern.startswith("SET ") and not pattern.startswith("COMMIT"):
			n_plus_one_groups.append({
				"pattern": pattern,
				"count": len(group),
				"total_ms": round(sum(g["duration_ms"] for g in group), 2),
				"sample_query": group[0]["query"],
				"caller": group[0]["caller"],
			})

	# Mark individual queries if they are part of an N+1 group
	n1_patterns = {g["pattern"]: g["count"] for g in n_plus_one_groups}
	formatted_queries = []
	for q in queries:
		formatted_queries.append({
			"query": q["query"],
			"duration_ms": q["duration_ms"],
			"caller": q["caller"],
			"is_n_plus_one": q["pattern"] in n1_patterns,
			"repeat_count": n1_patterns.get(q["pattern"], 1),
			"is_slow": q["duration_ms"] >= 30.0,
		})

	return {
		"total_queries": len(queries),
		"total_duration_ms": total_duration,
		"slow_queries_count": len(slow_queries),
		"n_plus_one_count": len(n_plus_one_groups),
		"queries": formatted_queries,
		"n_plus_one_groups": n_plus_one_groups,
	}


def clear_query_buffer() -> None:
	"""Clear the query buffer."""
	_query_buffer.clear()
