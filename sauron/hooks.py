"""
Frappe App hooks for Sauron Debugger.
Integrates browser client script and auto-injects Python dumper on boot.
"""

from __future__ import annotations

import sauron

# Auto-inject sauron into builtins when Frappe loads hooks
sauron.install()

app_name = "sauron"
app_title = "Sauron Debugger"
app_publisher = "Brightside"
app_description = "Terminal-based real-time debugging suite for Frappe and Python applications"
app_icon = "octicon octicon-eye"
app_color = "purple"
app_email = "dev@brightside.local"
app_license = "mit"

# Injects window.sauron & DevBar into Desk UI browser runtime
app_include_js = "/assets/sauron/js/sauron.bundle.js"
app_include_css = "/assets/sauron/css/sauron.devbar.css"

