"""
Sauron: Terminal-based Real-time Debugger for Frappe & Python.
"""

from __future__ import annotations

import builtins
import sys
import types
from typing import Any

from sauron.client import SauronClient, SauronPayload

__version__ = "0.2.0"

# Global default client instance
sauron = SauronClient()


def install() -> None:
	"""Inject sauron into Python's builtins and hook SQL query tracer."""
	if not hasattr(builtins, "sauron"):
		setattr(builtins, "sauron", sauron)

	try:
		from sauron.query_tracer import hook_database_tracer
		hook_database_tracer()
	except Exception:
		pass


# Automatically inject into builtins on module import
install()


class _SauronModule(types.ModuleType):
	"""Callable module wrapper allowing `import sauron; sauron(val)` and `sauron.sql(...)`."""

	def __call__(self, *args: Any, **kwargs: Any) -> SauronPayload:
		return sauron(*args, **kwargs)

	def __getattr__(self, name: str) -> Any:
		if hasattr(sauron, name):
			return getattr(sauron, name)
		raise AttributeError(f"module 'sauron' has no attribute '{name}'")


sys.modules[__name__].__class__ = _SauronModule

__all__ = ["sauron", "SauronClient", "SauronPayload", "install", "__version__"]
