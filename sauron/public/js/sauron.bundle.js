/**
 * Sauron Developer Experience (DX) Suite
 * - In-Desk Real-time Log Streamer & Viewer (Ray/Telescope alternative)
 * - Active / Pause Recording Toggle
 * - Fast User Impersonation & Form Inspector
 * - Multi-IDE Quick Code Jump (Zed, Cursor, VSCode)
 * - Live SQL & N+1 Query Profiler
 */

(function () {
	const SAURON_ENDPOINT = "http://127.0.0.1:7777/";

	// ==========================================
	// 1. Terminal & In-Memory Transport
	// ==========================================

	function sendPayload(payload) {
		// 1. Send to local port 7777 terminal receiver if available
		try {
			fetch(SAURON_ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
				mode: "cors",
			}).catch(() => {});
		} catch (e) {}

		// 2. Also push to backend in-memory buffer for In-Desk Live Viewer
		try {
			if (typeof frappe !== "undefined" && frappe.call) {
				frappe.call({
					method: "sauron.api.push_browser_log",
					args: { payload: JSON.stringify(payload) },
					silent: true,
				});
			}
		} catch (e) {}
	}

	window.sauron = function (data, label = "Browser JS", color = "purple") {
		const stack = new Error().stack || "";
		const stackLines = stack.split("\n");
		let callerLine = stackLines[2] || "Desk UI";

		const payload = {
			uuid: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
			type: "custom",
			content: data,
			label: label,
			color: color,
			origin: {
				file: "Desk UI Browser",
				line_number: 0,
				function_name: callerLine.trim().slice(0, 50),
			},
			timestamp: Date.now() / 1000,
		};
		sendPayload(payload);
	};

	window.sauron.table = function (rows, headers = null, label = "Browser Table", color = "blue") {
		const payload = {
			uuid: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
			type: "table",
			content: { rows: rows, headers: headers },
			label: label,
			color: color,
			origin: { file: "Desk UI Browser", line_number: 0, function_name: "table()" },
			timestamp: Date.now() / 1000,
		};
		sendPayload(payload);
	};

	window.sauron.clear = function () {
		sendPayload({ type: "clear", timestamp: Date.now() / 1000 });
		if (typeof frappe !== "undefined" && frappe.call) {
			frappe.call({ method: "sauron.api.clear_live_logs", silent: true });
		}
	};

	if (typeof frappe !== "undefined") {
		frappe.sauron = window.sauron;
	}

	// ==========================================
	// 2. Sauron In-Desk Floating DevBar (Native Theme)
	// ==========================================

	const DEVBAR_CSS = `
		#sauron-devbar-root {
			position: fixed;
			bottom: 20px;
			right: 24px;
			z-index: 1050;
			font-family: var(--font-stack, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
			font-size: var(--text-sm, 12px);
			line-height: 1.5;
			color: var(--text-color, #3c4257);
			user-select: none;
		}
		.sauron-pill-btn {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 44px;
			height: 44px;
			min-width: 44px;
			min-height: 44px;
			background: var(--card-bg, #ffffff) !important;
			color: var(--heading-color, #0a2540) !important;
			border: 1.5px solid var(--border-color, #e3e8ee) !important;
			padding: 0 !important;
			border-radius: 50% !important;
			cursor: pointer;
			box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1) !important;
			transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
			overflow: hidden;
		}
		.sauron-pill-btn:hover {
			background: var(--card-bg, #ffffff) !important;
			border-color: #f97316 !important;
			box-shadow: 0 8px 24px rgba(249, 115, 22, 0.28), 0 4px 12px rgba(0, 0, 0, 0.1) !important;
			transform: scale(1.08) translateY(-2px);
		}
		.sauron-pill-btn:active {
			transform: scale(0.96);
		}
		.sauron-tower-icon {
			width: 28px;
			height: 28px;
			display: block;
			transition: transform 0.2s ease;
		}
		.sauron-pill-btn:hover .sauron-tower-icon {
			transform: scale(1.06);
		}
		.sauron-devbar-panel {
			display: flex;
			flex-direction: column;
			position: absolute;
			bottom: calc(100% + 12px);
			right: 0;
			width: 360px;
			max-height: 560px;
			background: var(--card-bg, #ffffff) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			border-radius: var(--border-radius-xl, 10px) !important;
			box-shadow: var(--shadow-lg, 0 12px 32px rgba(0, 0, 0, 0.12)) !important;
			overflow: hidden;
			animation: sauron-slide-up 0.18s cubic-bezier(0.16, 1, 0.3, 1);
		}
		.sauron-devbar-panel.hidden {
			display: none !important;
		}
		@keyframes sauron-slide-up {
			from { opacity: 0; transform: translateY(8px) scale(0.98); }
			to { opacity: 1; transform: translateY(0) scale(1); }
		}
		.sauron-panel-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 10px 14px;
			background: var(--subtle-accent, #f6f9fc) !important;
			border-bottom: 1px solid var(--border-color, #e3e8ee) !important;
		}
		.sauron-header-title {
			font-weight: 600;
			font-size: 13px;
			color: var(--heading-color, #0a2540) !important;
			display: flex;
			align-items: center;
			gap: 6px;
		}
		.sauron-badge-dev {
			background: var(--gray-200, #e3e8ee) !important;
			color: var(--text-color, #3c4257) !important;
			font-size: 10px;
			font-weight: 600;
			padding: 1px 6px;
			border-radius: var(--border-radius-sm, 4px);
			letter-spacing: 0.2px;
		}
		.sauron-btn-close {
			background: transparent;
			border: none;
			color: var(--text-muted, #697386);
			font-size: 18px;
			line-height: 1;
			cursor: pointer;
			padding: 2px 6px;
			border-radius: var(--border-radius-sm, 4px);
		}
		.sauron-btn-close:hover {
			color: var(--heading-color, #0a2540);
			background: var(--gray-200, #e3e8ee);
		}
		.sauron-panel-body {
			padding: 12px;
			overflow-y: auto;
			max-height: 480px;
			display: flex;
			flex-direction: column;
			gap: 10px;
			background: var(--card-bg, #ffffff) !important;
		}
		.sauron-section {
			background: var(--bg-color, #f6f9fc) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			border-radius: var(--border-radius-md, 6px);
			padding: 10px;
		}
		.sauron-section-title {
			font-size: 11px;
			font-weight: 600;
			color: var(--text-muted, #697386) !important;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			margin-bottom: 8px;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.sauron-select-user {
			width: 100%;
			background: var(--card-bg, #ffffff) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			color: var(--text-color, #3c4257) !important;
			border-radius: var(--border-radius, 4px);
			padding: 6px 10px;
			font-size: 12px;
			cursor: pointer;
			outline: none;
			transition: border-color 0.15s ease;
		}
		.sauron-select-user:focus {
			border-color: var(--primary, #0052ff) !important;
			box-shadow: var(--focus-default, 0 0 0 2px rgba(0, 82, 255, 0.25)) !important;
		}
		.sauron-form-info {
			font-size: 11px;
			color: var(--text-color, #3c4257) !important;
			background: var(--card-bg, #ffffff) !important;
			padding: 6px 8px;
			border-radius: var(--border-radius-sm, 4px);
			border: 1px solid var(--border-color, #e3e8ee) !important;
			margin-bottom: 8px;
		}
		.sauron-info-row {
			display: flex;
			justify-content: space-between;
			padding: 2px 0;
		}
		.sauron-info-label {
			color: var(--text-muted, #697386);
		}
		.sauron-info-val {
			font-weight: 600;
			color: var(--heading-color, #0a2540) !important;
		}
		.sauron-actions-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 6px;
		}
		.sauron-action-btn {
			background: var(--card-bg, #ffffff) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			color: var(--text-color, #3c4257) !important;
			padding: 6px 10px;
			border-radius: var(--border-radius, 4px);
			font-size: 11px;
			font-weight: 500;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
			transition: all 0.12s ease;
		}
		.sauron-action-btn:hover {
			background: var(--fg-hover-color, #eff3f8) !important;
			border-color: var(--dark-border-color, #d3d9e0) !important;
			color: var(--heading-color, #0a2540) !important;
		}
		.sauron-action-btn.btn-dump {
			background: var(--primary, #0052ff) !important;
			border-color: var(--primary, #0052ff) !important;
			color: #ffffff !important;
			font-weight: 600;
			grid-column: span 2;
		}
		.sauron-action-btn.btn-dump:hover {
			filter: brightness(1.08);
			box-shadow: 0 2px 6px rgba(0, 82, 255, 0.35);
		}
		.sauron-code-links {
			display: flex;
			gap: 6px;
		}
		.sauron-code-link {
			flex: 1;
			background: var(--card-bg, #ffffff) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			border-radius: var(--border-radius, 4px);
			padding: 5px 8px;
			text-align: center;
			color: var(--primary, #0052ff) !important;
			font-size: 11px;
			font-weight: 600;
			text-decoration: none;
			transition: all 0.12s ease;
		}
		.sauron-code-link:hover {
			background: var(--fg-hover-color, #eff3f8) !important;
			border-color: var(--primary, #0052ff) !important;
			text-decoration: none;
		}
		.sauron-code-link.disabled {
			opacity: 0.4;
			pointer-events: none;
			color: var(--text-light, #8792a2) !important;
			border-color: var(--border-color, #e3e8ee) !important;
			background: var(--disabled-control-bg, #f6f9fc) !important;
		}
		.sauron-select-ide {
			background: var(--card-bg, #ffffff) !important;
			border: 1px solid var(--border-color, #e3e8ee) !important;
			color: var(--heading-color, #0a2540) !important;
			border-radius: var(--border-radius-sm, 4px);
			padding: 1px 6px;
			font-size: 11px;
			font-weight: 500;
			cursor: pointer;
			outline: none;
			line-height: 1.3;
			text-transform: none;
			transition: border-color 0.15s ease;
		}
		.sauron-select-ide:focus {
			border-color: var(--primary, #0052ff) !important;
		}

		/* SQL & N+1 Inspector */
		.sauron-btn-text {
			background: transparent;
			border: none;
			color: var(--primary, #0052ff);
			font-size: 10px;
			font-weight: 600;
			cursor: pointer;
			padding: 0;
		}
		.sauron-btn-text:hover {
			text-decoration: underline;
		}
		.sauron-sql-badge {
			display: flex;
			align-items: center;
			gap: 6px;
			background: var(--card-bg, #ffffff);
			border: 1px solid var(--border-color, #e3e8ee);
			border-radius: var(--border-radius-sm, 4px);
			padding: 6px 10px;
			font-size: 11px;
			color: var(--text-color, #3c4257);
			font-weight: 500;
		}
		.sauron-n1-tag {
			margin-left: auto;
			background: #fee2e2;
			color: #dc2626;
			border: 1px solid #fca5a5;
			padding: 1px 6px;
			border-radius: 9999px;
			font-size: 10px;
			font-weight: 700;
		}
		.sauron-n1-tag.hidden {
			display: none !important;
		}

		/* Live Debug Logs Section & Drawer */
		.sauron-log-status-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			background: var(--card-bg, #ffffff);
			border: 1px solid var(--border-color, #e3e8ee);
			border-radius: var(--border-radius-sm, 4px);
			padding: 6px 10px;
			font-size: 11px;
			color: var(--text-color, #3c4257);
			font-weight: 500;
		}
		.sauron-log-indicator {
			font-weight: 700;
			font-size: 11px;
			display: inline-flex;
			align-items: center;
			gap: 4px;
		}
		.sauron-log-indicator.live {
			color: #16a34a;
		}
		.sauron-log-indicator.paused {
			color: #ea580c;
		}
		.sauron-log-drawer {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 860px;
			max-width: 92vw;
			height: 85vh;
			background: var(--card-bg, #ffffff);
			border: 1px solid var(--border-color, #e3e8ee);
			border-radius: var(--border-radius-xl, 10px);
			box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
			z-index: 1060;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.sauron-log-drawer.hidden {
			display: none !important;
		}
		.sauron-drawer-actions {
			display: flex;
			align-items: center;
			gap: 8px;
		}
		.sauron-btn-pill-toggle {
			background: var(--card-bg, #ffffff);
			border: 1px solid var(--border-color, #e3e8ee);
			color: var(--text-color, #3c4257);
			padding: 4px 10px;
			border-radius: var(--border-radius-2xl, 9999px);
			font-size: 11px;
			font-weight: 600;
			cursor: pointer;
			transition: all 0.12s ease;
		}
		.sauron-btn-pill-toggle.active {
			background: #dcfce7;
			border-color: #86efac;
			color: #15803d;
		}
		.sauron-btn-pill-toggle.paused {
			background: #ffedd5;
			border-color: #fed7aa;
			color: #c2410c;
		}
		.sauron-filter-bar {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 18px;
			background: var(--bg-color, #f6f9fc);
			border-bottom: 1px solid var(--border-color, #e3e8ee);
			font-size: 11px;
		}
		.sauron-filter-tabs {
			display: flex;
			gap: 4px;
		}
		.sauron-filter-tab {
			background: transparent;
			border: 1px solid transparent;
			color: var(--text-muted, #697386);
			padding: 3px 8px;
			border-radius: var(--border-radius-sm, 4px);
			cursor: pointer;
			font-weight: 500;
			font-size: 11px;
			transition: all 0.12s ease;
		}
		.sauron-filter-tab.active {
			background: var(--card-bg, #ffffff);
			border-color: var(--border-color, #e3e8ee);
			color: var(--heading-color, #0a2540);
			font-weight: 600;
			box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		}
		.sauron-log-stream {
			flex: 1;
			padding: 14px 18px;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 10px;
			background: var(--card-bg, #ffffff);
		}
		.sauron-log-card {
			background: var(--bg-color, #f6f9fc);
			border: 1px solid var(--border-color, #e3e8ee);
			border-left: 3px solid var(--primary, #0052ff);
			border-radius: var(--border-radius-md, 6px);
			padding: 10px 12px;
			display: flex;
			flex-direction: column;
			gap: 6px;
			font-size: 12px;
			animation: sauron-card-in 0.15s ease-out;
		}
		.sauron-log-card.color-green { border-left-color: #16a34a; }
		.sauron-log-card.color-red { border-left-color: #dc2626; background: #fffafa; }
		.sauron-log-card.color-purple { border-left-color: #9333ea; }
		.sauron-log-card.color-yellow { border-left-color: #ca8a04; }
		.sauron-log-card.color-orange { border-left-color: #ea580c; }
		.sauron-log-card.color-gray { border-left-color: #64748b; }
		@keyframes sauron-card-in {
			from { opacity: 0; transform: translateY(4px); }
			to { opacity: 1; transform: translateY(0); }
		}
		.sauron-log-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 11px;
		}
		.sauron-badge-label {
			background: var(--gray-200, #e3e8ee);
			color: var(--heading-color, #0a2540);
			font-weight: 600;
			padding: 1px 6px;
			border-radius: var(--border-radius-sm, 4px);
			font-size: 10px;
			text-transform: uppercase;
			letter-spacing: 0.3px;
		}
		.sauron-log-payload-box {
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 11px;
			color: var(--heading-color, #0a2540);
			background: var(--card-bg, #ffffff);
			padding: 8px 10px;
			border-radius: var(--border-radius-sm, 4px);
			border: 1px solid var(--border-color, #e3e8ee);
			overflow-x: auto;
			white-space: pre-wrap;
			word-break: break-all;
			max-height: 240px;
		}

		/* SQL Queries Modal Drawer */
		.sauron-sql-drawer {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 720px;
			max-width: 90vw;
			max-height: 80vh;
			background: var(--card-bg, #ffffff);
			border: 1px solid var(--border-color, #e3e8ee);
			border-radius: var(--border-radius-xl, 10px);
			box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
			z-index: 1060;
			display: flex;
			flex-direction: column;
			overflow: hidden;
		}
		.sauron-sql-drawer.hidden {
			display: none !important;
		}
		.sauron-sql-drawer-backdrop {
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(15, 23, 42, 0.45);
			backdrop-filter: blur(4px);
			z-index: 1055;
		}
		.sauron-sql-drawer-backdrop.hidden {
			display: none !important;
		}
		.sauron-drawer-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 12px 18px;
			background: var(--subtle-accent, #f6f9fc);
			border-bottom: 1px solid var(--border-color, #e3e8ee);
		}
		.sauron-drawer-title {
			font-size: 14px;
			font-weight: 700;
			color: var(--heading-color, #0a2540);
		}
		.sauron-drawer-body {
			padding: 14px 18px;
			overflow-y: auto;
			max-height: calc(80vh - 60px);
			display: flex;
			flex-direction: column;
			gap: 10px;
		}
		.sauron-n1-alert-box {
			background: #fef2f2;
			border: 1px solid #fecaca;
			border-radius: var(--border-radius-md, 6px);
			padding: 10px 14px;
			color: #991b1b;
			font-size: 12px;
			line-height: 1.4;
		}
		.sauron-n1-alert-box strong {
			color: #b91c1c;
		}
		.sauron-query-item {
			background: var(--bg-color, #f6f9fc);
			border: 1px solid var(--border-color, #e3e8ee);
			border-radius: var(--border-radius-md, 6px);
			padding: 10px 12px;
			font-size: 12px;
			display: flex;
			flex-direction: column;
			gap: 6px;
		}
		.sauron-query-item.is-n1 {
			border-left: 3px solid #dc2626;
			background: #fffafa;
		}
		.sauron-query-meta {
			display: flex;
			align-items: center;
			justify-content: space-between;
			font-size: 11px;
		}
		.sauron-query-caller {
			color: var(--text-muted, #697386);
			font-family: monospace;
		}
		.sauron-query-tags {
			display: flex;
			gap: 6px;
		}
		.sauron-tag-ms {
			background: var(--gray-200, #e3e8ee);
			color: var(--text-color, #3c4257);
			padding: 1px 6px;
			border-radius: var(--border-radius-sm, 4px);
			font-weight: 600;
			font-size: 10px;
		}
		.sauron-tag-ms.slow {
			background: #fed7aa;
			color: #c2410c;
		}
		.sauron-tag-n1 {
			background: #fee2e2;
			color: #dc2626;
			padding: 1px 6px;
			border-radius: var(--border-radius-sm, 4px);
			font-weight: 700;
			font-size: 10px;
		}
		.sauron-query-sql {
			font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
			font-size: 11px;
			color: var(--heading-color, #0a2540);
			background: var(--card-bg, #ffffff);
			padding: 8px 10px;
			border-radius: var(--border-radius-sm, 4px);
			border: 1px solid var(--border-color, #e3e8ee);
			word-break: break-all;
			white-space: pre-wrap;
		}
	`;

	const TOWER_SVG = `
		<svg class="sauron-tower-icon" viewBox="0 0 100 100" width="28" height="28" fill="none" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<radialGradient id="sauron-eye-flame" cx="50%" cy="50%" r="50%">
					<stop offset="0%" stop-color="#fffbeb" />
					<stop offset="30%" stop-color="#fde047" />
					<stop offset="60%" stop-color="#f97316" />
					<stop offset="90%" stop-color="#dc2626" />
					<stop offset="100%" stop-color="#7f1d1d" stop-opacity="0" />
				</radialGradient>
				<linearGradient id="sauron-tower-dark" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#334155" />
					<stop offset="50%" stop-color="#1e293b" />
					<stop offset="100%" stop-color="#0f172a" />
				</linearGradient>
			</defs>
			<!-- Base & Buttresses of Barad-dur -->
			<path d="M15 95 L25 80 L35 84 L40 70 L60 70 L65 84 L75 80 L85 95 Z" fill="url(#sauron-tower-dark)" />
			<path d="M26 80 L32 58 L38 60 L42 46 L58 46 L62 60 L68 58 L74 80 Z" fill="#1e293b" />
			<path d="M38 52 L43 32 L57 32 L62 52 Z" fill="#0f172a" />
			<path d="M44 48 L46 34 L54 34 L56 48 Z" fill="#090d16" />
			<!-- Left Spire -->
			<path d="M36 36 L43 14 L46 22 L45 34 Z" fill="#334155" />
			<path d="M39 34 L43 14 L42 32 Z" fill="#64748b" opacity="0.6" />
			<!-- Right Spire -->
			<path d="M64 36 L57 14 L54 22 L55 34 Z" fill="#1e293b" />
			<path d="M61 34 L57 14 L58 32 Z" fill="#475569" opacity="0.4" />
			<!-- Crown Pinnacle Horns -->
			<polygon points="46,32 48,22 50,30" fill="#334155" />
			<polygon points="54,32 52,22 50,30" fill="#1e293b" />
			<!-- Fiery Eye of Sauron -->
			<g transform="translate(50, 24)">
				<ellipse cx="0" cy="0" rx="18" ry="11" fill="url(#sauron-eye-flame)" />
				<path d="M -16 0 Q -7 -9 0 -11 Q 7 -9 16 0 Q 7 9 0 11 Q -7 9 -16 0 Z" fill="#ea580c" opacity="0.85" />
				<path d="M -13 0 Q -5 -7 0 -8 Q 5 -7 13 0 Q 5 7 0 8 Q -5 7 -13 0 Z" fill="#facc15" />
				<path d="M -8 0 Q -3 -5 0 -6 Q 3 -5 8 0 Q 3 5 0 6 Q -3 5 -8 0 Z" fill="#fffbeb" />
				<ellipse cx="0" cy="0" rx="1.5" ry="6.5" fill="#090d16" />
			</g>
		</svg>
	`;

	let devbarContext = null;
	let isHiddenFieldsRevealed = false;
	let isReadOnlyUnlocked = false;
	let currentResolvedFiles = null;
	let latestSQLStats = null;

	// Live Log Streamer State
	let isRecording = true;
	let lastLogTimestamp = 0;
	let streamLogs = [];
	let activeFilter = "all";
	let autoScroll = true;
	let logPollingTimer = null;

	function injectDevBarStyles() {
		if (document.getElementById("sauron-devbar-style")) return;
		const style = document.createElement("style");
		style.id = "sauron-devbar-style";
		style.textContent = DEVBAR_CSS;
		document.head.appendChild(style);
	}

	function initDevBar() {
		if (document.getElementById("sauron-devbar-root")) return;

		injectDevBarStyles();

		// Fetch DevBar Context from backend
		if (typeof frappe !== "undefined" && frappe.call) {
			frappe.call({
				method: "sauron.api.get_devbar_context",
				callback: function (r) {
					if (r && r.message && r.message.enabled) {
						devbarContext = r.message;
						renderDevBarUI(devbarContext);
					}
				},
			});
		}
	}

	function renderDevBarUI(ctx) {
		if (document.getElementById("sauron-devbar-root")) return;

		const root = document.createElement("div");
		root.id = "sauron-devbar-root";

		const preferredIDE = localStorage.getItem("sauron_preferred_ide") || "zed";

		root.innerHTML = `
			<div class="sauron-pill-btn" id="sauron-toggle-btn" title="Sauron DevBar (Cmd+Shift+S)">
				${TOWER_SVG}
			</div>

			<div class="sauron-devbar-panel hidden" id="sauron-panel">
				<div class="sauron-panel-header">
					<div class="sauron-header-title">
						<div style="width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; margin-right: 2px;">
							${TOWER_SVG}
						</div>
						<span>Sauron DevBar</span>
						<span class="sauron-badge-dev">${ctx.site || "Dev"}</span>
					</div>
					<button class="sauron-btn-close" id="sauron-close-btn">&times;</button>
				</div>

				<div class="sauron-panel-body">
					<!-- 1. Live Debug Logs Section -->
					<div class="sauron-section" id="sauron-logs-section">
						<div class="sauron-section-title">
							<span>Live Debug Logs</span>
							<button class="sauron-btn-text" id="sauron-btn-clear-logs">Clear</button>
						</div>
						<div class="sauron-log-status-bar">
							<span class="sauron-log-indicator live" id="sauron-log-indicator">● Active</span>
							<span id="sauron-log-count">0 Events</span>
						</div>
						<div class="sauron-actions-grid" style="margin-top: 8px;">
							<button class="sauron-action-btn btn-dump" id="sauron-btn-open-log-drawer" style="grid-column: span 1;">
								<span>Open Log Viewer</span>
							</button>
							<button class="sauron-action-btn" id="sauron-btn-toggle-rec">
								<span id="sauron-rec-btn-text">Pause</span>
							</button>
						</div>
					</div>

					<!-- 2. Fast Impersonation -->
					<div class="sauron-section">
						<div class="sauron-section-title">
							<span>Fast Impersonate</span>
							<span style="color: var(--primary, #0052ff); font-weight: normal; font-size: 10px;">Current: ${ctx.current_user || "User"}</span>
						</div>
						<select class="sauron-select-user" id="sauron-user-switcher">
							<option value="" disabled selected>Switch User / Role...</option>
							${(ctx.users || [])
								.map(
									(u) => `
								<option value="${u.name}" ${u.name === ctx.current_user ? "disabled" : ""}>
									${u.full_name || u.name} (${u.roles ? u.roles.slice(0, 2).join(", ") : "User"})
								</option>
							`
								)
								.join("")}
						</select>
					</div>

					<!-- 3. Active Form Inspector -->
					<div class="sauron-section" id="sauron-form-section">
						<div class="sauron-section-title">
							<span>Active Form Inspector</span>
						</div>
						<div class="sauron-form-info" id="sauron-form-meta">
							<div class="sauron-info-row">
								<span class="sauron-info-label">DocType:</span>
								<span class="sauron-info-val" id="sauron-cur-doctype">-</span>
							</div>
							<div class="sauron-info-row">
								<span class="sauron-info-label">DocName:</span>
								<span class="sauron-info-val" id="sauron-cur-docname">-</span>
							</div>
						</div>

						<div class="sauron-actions-grid">
							<button class="sauron-action-btn btn-dump" id="sauron-btn-dump-form">
								<span>Dump Form to Log</span>
							</button>
							<button class="sauron-action-btn" id="sauron-btn-toggle-hidden">
								<span>Show Hidden</span>
							</button>
							<button class="sauron-action-btn" id="sauron-btn-toggle-readonly">
								<span>Unlock Read-Only</span>
							</button>
							<button class="sauron-action-btn" id="sauron-btn-copy-json" style="grid-column: span 2;">
								<span>Copy Form JSON</span>
							</button>
						</div>
					</div>

					<!-- 4. Quick Code Jump (IDE) -->
					<div class="sauron-section" id="sauron-code-section">
						<div class="sauron-section-title">
							<span>Quick Code Jump</span>
							<select class="sauron-select-ide" id="sauron-ide-selector" title="Preferred Editor">
								<option value="zed" ${preferredIDE === "zed" ? "selected" : ""}>Zed</option>
								<option value="cursor" ${preferredIDE === "cursor" ? "selected" : ""}>Cursor</option>
								<option value="vscode" ${preferredIDE === "vscode" ? "selected" : ""}>VSCode</option>
							</select>
						</div>
						<div class="sauron-code-links" id="sauron-ide-links">
							<a href="#" class="sauron-code-link disabled" id="sauron-link-py">.py (Controller)</a>
							<a href="#" class="sauron-code-link disabled" id="sauron-link-js">.js (Script)</a>
							<a href="#" class="sauron-code-link disabled" id="sauron-link-json">.json (Schema)</a>
						</div>
					</div>

					<!-- 5. Live SQL & N+1 Query Inspector -->
					<div class="sauron-section" id="sauron-sql-section">
						<div class="sauron-section-title">
							<span>SQL & N+1 Inspector</span>
							<button class="sauron-btn-text" id="sauron-btn-refresh-sql">Refresh</button>
						</div>
						<div class="sauron-sql-badge" id="sauron-sql-summary">
							<span id="sauron-sql-count">0 Queries</span> · 
							<span id="sauron-sql-ms">0.0ms</span>
							<span class="sauron-n1-tag hidden" id="sauron-n1-alert">0 N+1</span>
						</div>
						<div class="sauron-actions-grid" style="margin-top: 8px;">
							<button class="sauron-action-btn" id="sauron-btn-view-sql">
								<span>View SQL Queries</span>
							</button>
							<button class="sauron-action-btn" id="sauron-btn-dump-sql">
								<span>Dump to Terminal</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Shared Backdrop -->
			<div class="sauron-sql-drawer-backdrop hidden" id="sauron-shared-backdrop"></div>

			<!-- Live Log Streamer Modal Drawer -->
			<div class="sauron-log-drawer hidden" id="sauron-log-drawer">
				<div class="sauron-drawer-header">
					<div class="sauron-drawer-title">
						<span>Live Debug Logs</span>
						<span class="sauron-badge-dev" id="sauron-log-stream-badge">0 Events</span>
					</div>
					<div class="sauron-drawer-actions">
						<button class="sauron-btn-pill-toggle active" id="sauron-drawer-rec-toggle">● Recording</button>
						<button class="sauron-action-btn" id="sauron-drawer-clear-btn" style="padding: 3px 8px; font-size: 11px;">Clear</button>
						<button class="sauron-btn-close" id="sauron-log-drawer-close">&times;</button>
					</div>
				</div>

				<div class="sauron-filter-bar">
					<div class="sauron-filter-tabs">
						<button class="sauron-filter-tab active" data-filter="all">All</button>
						<button class="sauron-filter-tab" data-filter="custom">Dumps</button>
						<button class="sauron-filter-tab" data-filter="table">Tables</button>
						<button class="sauron-filter-tab" data-filter="sql">SQL</button>
						<button class="sauron-filter-tab" data-filter="exception">Errors</button>
					</div>
					<div>
						<label style="font-size: 11px; cursor: pointer; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
							<input type="checkbox" id="sauron-chk-autoscroll" checked> Auto-scroll
						</label>
					</div>
				</div>

				<div class="sauron-log-stream" id="sauron-log-stream">
					<!-- Dynamically rendered live log cards -->
				</div>
			</div>

			<!-- SQL Queries Modal Drawer -->
			<div class="sauron-sql-drawer hidden" id="sauron-sql-drawer">
				<div class="sauron-drawer-header">
					<div class="sauron-drawer-title" id="sauron-drawer-title">SQL Query Profile</div>
					<button class="sauron-btn-close" id="sauron-sql-drawer-close">&times;</button>
				</div>
				<div class="sauron-drawer-body" id="sauron-drawer-body">
					<!-- Dynamically rendered SQL items -->
				</div>
			</div>
		`;

		document.body.appendChild(root);
		bindDevBarEvents();
		updateActiveFormInspector();
		fetchLiveSQLStats();
		pollLiveLogs();
	}

	function bindDevBarEvents() {
		const toggleBtn = document.getElementById("sauron-toggle-btn");
		const closeBtn = document.getElementById("sauron-close-btn");
		const panel = document.getElementById("sauron-panel");
		const userSelect = document.getElementById("sauron-user-switcher");
		const ideSelector = document.getElementById("sauron-ide-selector");

		const backdrop = document.getElementById("sauron-shared-backdrop");
		const logDrawer = document.getElementById("sauron-log-drawer");
		const sqlDrawer = document.getElementById("sauron-sql-drawer");

		function togglePanel() {
			if (!panel) return;
			panel.classList.toggle("hidden");
			if (!panel.classList.contains("hidden")) {
				updateActiveFormInspector();
				fetchLiveSQLStats();
				pollLiveLogs();
			}
		}

		function closeAllDrawers() {
			if (logDrawer) logDrawer.classList.add("hidden");
			if (sqlDrawer) sqlDrawer.classList.add("hidden");
			if (backdrop) backdrop.classList.add("hidden");
			stopLogPolling();
		}

		if (toggleBtn) toggleBtn.addEventListener("click", togglePanel);
		if (closeBtn) closeBtn.addEventListener("click", () => panel.classList.add("hidden"));
		
		const logDrawerClose = document.getElementById("sauron-log-drawer-close");
		if (logDrawerClose) logDrawerClose.addEventListener("click", closeAllDrawers);
		
		const sqlDrawerClose = document.getElementById("sauron-sql-drawer-close");
		if (sqlDrawerClose) sqlDrawerClose.addEventListener("click", closeAllDrawers);
		
		if (backdrop) backdrop.addEventListener("click", closeAllDrawers);

		// Keyboard shortcut Cmd+Shift+S or Ctrl+Shift+S
		window.addEventListener("keydown", (e) => {
			if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "s") {
				e.preventDefault();
				togglePanel();
			}
		});

		// User Switcher (Impersonate)
		if (userSelect) {
			userSelect.addEventListener("change", (e) => {
				const targetUser = e.target.value;
				if (!targetUser) return;

				frappe.call({
					method: "sauron.api.switch_user",
					args: { user: targetUser },
					freeze: true,
					freeze_message: `Switching session to ${targetUser}...`,
					callback: function (r) {
						if (r && r.message && r.message.success) {
							window.location.reload();
						}
					},
				});
			});
		}

		// IDE Selector
		if (ideSelector) {
			ideSelector.addEventListener("change", (e) => {
				const selectedIDE = e.target.value;
				localStorage.setItem("sauron_preferred_ide", selectedIDE);
				if (currentResolvedFiles) {
					applyCodeLinks(currentResolvedFiles, selectedIDE);
				}
			});
		}

		// Dump Form to Log
		const dumpFormBtn = document.getElementById("sauron-btn-dump-form");
		if (dumpFormBtn) {
			dumpFormBtn.addEventListener("click", () => {
				if (window.cur_frm && window.cur_frm.doc) {
					const label = `${window.cur_frm.doctype}: ${window.cur_frm.docname || "New"}`;
					window.sauron(window.cur_frm.doc, label, "purple");
					frappe.show_alert({ message: __("Form dumped to Sauron Live Logs!"), indicator: "green" }, 3);
					setTimeout(pollLiveLogs, 100);
				} else {
					frappe.show_alert({ message: __("No active Form Document detected."), indicator: "orange" }, 3);
				}
			});
		}

		// Toggle Hidden Fields
		const toggleHiddenBtn = document.getElementById("sauron-btn-toggle-hidden");
		if (toggleHiddenBtn) {
			toggleHiddenBtn.addEventListener("click", () => {
				if (!window.cur_frm) return;
				isHiddenFieldsRevealed = !isHiddenFieldsRevealed;
				Object.keys(window.cur_frm.fields_dict).forEach((f) => {
					const field = window.cur_frm.fields_dict[f];
					if (field && field.df) {
						field.df.hidden = isHiddenFieldsRevealed ? 0 : (field.df._orig_hidden ?? field.df.hidden);
					}
				});
				window.cur_frm.refresh();
				frappe.show_alert(
					{
						message: isHiddenFieldsRevealed ? __("All hidden fields revealed!") : __("Restored field visibility."),
						indicator: "blue",
					},
					3
				);
			});
		}

		// Unlock Read-Only Fields
		const toggleReadOnlyBtn = document.getElementById("sauron-btn-toggle-readonly");
		if (toggleReadOnlyBtn) {
			toggleReadOnlyBtn.addEventListener("click", () => {
				if (!window.cur_frm) return;
				isReadOnlyUnlocked = !isReadOnlyUnlocked;
				Object.keys(window.cur_frm.fields_dict).forEach((f) => {
					const field = window.cur_frm.fields_dict[f];
					if (field && field.df) {
						field.df.read_only = isReadOnlyUnlocked ? 0 : (field.df._orig_ro ?? field.df.read_only);
					}
				});
				window.cur_frm.refresh();
				frappe.show_alert(
					{
						message: isReadOnlyUnlocked ? __("All read-only fields unlocked!") : __("Restored read-only states."),
						indicator: "blue",
					},
					3
				);
			});
		}

		// Copy JSON
		const copyJsonBtn = document.getElementById("sauron-btn-copy-json");
		if (copyJsonBtn) {
			copyJsonBtn.addEventListener("click", () => {
				if (window.cur_frm && window.cur_frm.doc) {
					navigator.clipboard.writeText(JSON.stringify(window.cur_frm.doc, null, 2));
					frappe.show_alert({ message: __("Form JSON copied to clipboard!"), indicator: "green" }, 3);
				}
			});
		}

		// Open Log Viewer Drawer
		const openLogDrawerBtn = document.getElementById("sauron-btn-open-log-drawer");
		if (openLogDrawerBtn) {
			openLogDrawerBtn.addEventListener("click", () => {
				renderLogStream();
				if (logDrawer) logDrawer.classList.remove("hidden");
				if (backdrop) backdrop.classList.remove("hidden");
				startLogPolling();
			});
		}

		// Toggle Recording (DevBar & Drawer)
		function toggleRecordingState() {
			isRecording = !isRecording;
			frappe.call({
				method: "sauron.api.toggle_log_recording",
				args: { active: isRecording ? 1 : 0 },
				callback: function (r) {
					if (r && r.message) {
						updateRecordingUI(r.message.is_recording);
					}
				},
			});
		}

		const btnToggleRec = document.getElementById("sauron-btn-toggle-rec");
		if (btnToggleRec) btnToggleRec.addEventListener("click", toggleRecordingState);
		
		const drawerRecToggle = document.getElementById("sauron-drawer-rec-toggle");
		if (drawerRecToggle) drawerRecToggle.addEventListener("click", toggleRecordingState);

		// Clear Logs
		function clearAllLogs() {
			streamLogs = [];
			lastLogTimestamp = 0;
			frappe.call({
				method: "sauron.api.clear_live_logs",
				callback: function () {
					renderLogStream();
					updateLogBadge(0);
					frappe.show_alert({ message: __("Live logs cleared."), indicator: "green" }, 2);
				},
			});
		}

		const btnClearLogs = document.getElementById("sauron-btn-clear-logs");
		if (btnClearLogs) btnClearLogs.addEventListener("click", clearAllLogs);
		
		const drawerClearBtn = document.getElementById("sauron-drawer-clear-btn");
		if (drawerClearBtn) drawerClearBtn.addEventListener("click", clearAllLogs);

		// Filter Tabs
		document.querySelectorAll(".sauron-filter-tab").forEach((tab) => {
			tab.addEventListener("click", (e) => {
				document.querySelectorAll(".sauron-filter-tab").forEach((t) => t.classList.remove("active"));
				e.target.classList.add("active");
				activeFilter = e.target.getAttribute("data-filter");
				renderLogStream();
			});
		});

		// Auto-scroll checkbox
		const autoScrollChk = document.getElementById("sauron-chk-autoscroll");
		if (autoScrollChk) {
			autoScrollChk.addEventListener("change", (e) => {
				autoScroll = e.target.checked;
			});
		}

		// SQL Refresh Button
		const btnRefreshSql = document.getElementById("sauron-btn-refresh-sql");
		if (btnRefreshSql) btnRefreshSql.addEventListener("click", fetchLiveSQLStats);

		// View SQL Queries Drawer
		const btnViewSql = document.getElementById("sauron-btn-view-sql");
		if (btnViewSql) {
			btnViewSql.addEventListener("click", () => {
				renderSQLDrawer();
				if (sqlDrawer) sqlDrawer.classList.remove("hidden");
				if (backdrop) backdrop.classList.remove("hidden");
			});
		}

		// Dump SQL to Terminal
		const btnDumpSql = document.getElementById("sauron-btn-dump-sql");
		if (btnDumpSql) {
			btnDumpSql.addEventListener("click", () => {
				frappe.call({
					method: "sauron.api.dump_queries_to_terminal",
					callback: function (r) {
						if (r && r.message && r.message.success) {
							frappe.show_alert({ message: __(`Dumped ${r.message.count} queries to Sauron Terminal!`), indicator: "green" }, 3);
						}
					},
				});
			});
		}
	}

	// ==========================================
	// 3. Live Log Polling & Rendering
	// ==========================================

	function startLogPolling() {
		stopLogPolling();
		pollLiveLogs();
		logPollingTimer = setInterval(pollLiveLogs, 1000);
	}

	function stopLogPolling() {
		if (logPollingTimer) {
			clearInterval(logPollingTimer);
			logPollingTimer = null;
		}
	}

	function pollLiveLogs() {
		if (typeof frappe === "undefined" || !frappe.call) return;
		
		frappe.call({
			method: "sauron.api.get_live_logs",
			args: { since_ts: lastLogTimestamp, limit: 50 },
			silent: true,
			callback: function (r) {
				if (r && r.message) {
					const data = r.message;
					isRecording = data.is_recording;
					updateRecordingUI(isRecording);

					if (data.logs && data.logs.length > 0) {
						// Append new logs avoiding duplicate uuids
						const existingUuids = new Set(streamLogs.map((l) => l.uuid));
						data.logs.forEach((log) => {
							if (!existingUuids.has(log.uuid)) {
								streamLogs.push(log);
								existingUuids.add(log.uuid);
							}
						});
						lastLogTimestamp = data.latest_timestamp || Date.now() / 1000;
						renderLogStream();
					}
					updateLogBadge(data.total_in_buffer || streamLogs.length);
				}
			},
		});
	}

	function updateRecordingUI(active) {
		const indicator = document.getElementById("sauron-log-indicator");
		const recBtnText = document.getElementById("sauron-rec-btn-text");
		const drawerToggle = document.getElementById("sauron-drawer-rec-toggle");

		if (active) {
			if (indicator) {
				indicator.className = "sauron-log-indicator live";
				indicator.textContent = "● Active";
			}
			if (recBtnText) recBtnText.textContent = "Pause";
			if (drawerToggle) {
				drawerToggle.className = "sauron-btn-pill-toggle active";
				drawerToggle.textContent = "● Recording";
			}
		} else {
			if (indicator) {
				indicator.className = "sauron-log-indicator paused";
				indicator.textContent = "⏸ Paused";
			}
			if (recBtnText) recBtnText.textContent = "Resume";
			if (drawerToggle) {
				drawerToggle.className = "sauron-btn-pill-toggle paused";
				drawerToggle.textContent = "⏸ Paused";
			}
		}
	}

	function updateLogBadge(count) {
		const countElem = document.getElementById("sauron-log-count");
		const streamBadge = document.getElementById("sauron-log-stream-badge");
		if (countElem) countElem.textContent = `${count} Events`;
		if (streamBadge) streamBadge.textContent = `${count} Events`;
	}

	function renderLogStream() {
		const container = document.getElementById("sauron-log-stream");
		if (!container) return;

		let filtered = streamLogs;
		if (activeFilter !== "all") {
			filtered = streamLogs.filter((l) => l.type === activeFilter);
		}

		if (!filtered || filtered.length === 0) {
			container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px;">No logs captured yet. Trigger sauron(var) from Python or click Dump Form above.</div>`;
			return;
		}

		container.innerHTML = filtered
			.map((log) => {
				const origin = log.origin || {};
				const colorClass = `color-${log.color || "blue"}`;
				const timeStr = formatTimestamp(log.timestamp);
				const label = log.label || "Debug";

				let contentHtml = "";
				if (log.type === "table" && log.content && log.content.rows) {
					contentHtml = renderTableHtml(log.content.rows, log.content.headers);
				} else if (log.type === "custom") {
					contentHtml = `<div class="sauron-log-payload-box">${escapeHtml(
						typeof log.content === "object" ? JSON.stringify(log.content, null, 2) : String(log.content)
					)}</div>`;
				} else {
					contentHtml = `<div class="sauron-log-payload-box">${escapeHtml(JSON.stringify(log.content, null, 2))}</div>`;
				}

				return `
					<div class="sauron-log-card ${colorClass}">
						<div class="sauron-log-header">
							<div style="display: flex; align-items: center; gap: 8px;">
								<span class="sauron-badge-label">${escapeHtml(label)}</span>
								<span style="color: var(--text-muted); font-size: 10px;">${timeStr}</span>
							</div>
							<div style="color: var(--text-muted); font-family: monospace; font-size: 11px;">
								${escapeHtml(origin.file ? origin.file.split("/").pop() + ":" + origin.line_number : "")}
							</div>
						</div>
						${contentHtml}
					</div>
				`;
			})
			.join("");

		if (autoScroll) {
			container.scrollTop = container.scrollHeight;
		}
	}

	function renderTableHtml(rows, headers) {
		if (!Array.isArray(rows) || rows.length === 0) {
			return `<div class="sauron-log-payload-box">Empty table</div>`;
		}
		const keys = headers || Object.keys(rows[0] || {});
		return `
			<div style="overflow-x: auto; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px;">
				<table style="width: 100%; border-collapse: collapse; font-size: 11px; text-align: left;">
					<thead>
						<tr style="background: var(--subtle-accent); border-bottom: 1px solid var(--border-color);">
							${keys.map((k) => `<th style="padding: 6px 10px; font-weight: 600; color: var(--heading-color);">${escapeHtml(k)}</th>`).join("")}
						</tr>
					</thead>
					<tbody>
						${rows
							.map(
								(row) => `
							<tr style="border-bottom: 1px solid var(--border-color);">
								${keys.map((k) => `<td style="padding: 5px 10px; color: var(--text-color);">${escapeHtml(String(row[k] ?? ""))}</td>`).join("")}
							</tr>
						`
							)
							.join("")}
					</tbody>
				</table>
			</div>
		`;
	}

	function formatTimestamp(ts) {
		if (!ts) return "";
		const d = new Date(ts * 1000);
		return d.toTimeString().split(" ")[0] + "." + String(d.getMilliseconds()).padStart(3, "0");
	}

	function fetchLiveSQLStats() {
		if (typeof frappe === "undefined" || !frappe.call) return;
		frappe.call({
			method: "sauron.api.get_live_sql_stats",
			args: { limit: 50 },
			silent: true,
			callback: function (r) {
				if (r && r.message) {
					latestSQLStats = r.message;
					updateSQLBadge(latestSQLStats);
				}
			},
		});
	}

	function updateSQLBadge(stats) {
		const countElem = document.getElementById("sauron-sql-count");
		const msElem = document.getElementById("sauron-sql-ms");
		const n1Tag = document.getElementById("sauron-n1-alert");
		if (!countElem || !msElem || !n1Tag) return;

		countElem.textContent = `${stats.total_queries} Queries`;
		msElem.textContent = `${stats.total_duration_ms}ms`;

		if (stats.n_plus_one_count > 0) {
			n1Tag.textContent = `${stats.n_plus_one_count} N+1 Warning`;
			n1Tag.classList.remove("hidden");
		} else {
			n1Tag.classList.add("hidden");
		}
	}

	function renderSQLDrawer() {
		const body = document.getElementById("sauron-drawer-body");
		const title = document.getElementById("sauron-drawer-title");
		if (!body || !latestSQLStats) return;

		title.textContent = `SQL Query Profiler (${latestSQLStats.total_queries} queries · ${latestSQLStats.total_duration_ms}ms total)`;

		let html = "";

		if (latestSQLStats.n_plus_one_groups && latestSQLStats.n_plus_one_groups.length > 0) {
			html += `
				<div class="sauron-n1-alert-box">
					<strong>N+1 Duplicate Query Alert:</strong> ${latestSQLStats.n_plus_one_groups.length} repeating query patterns detected.
					<ul style="margin: 6px 0 0 16px; padding: 0;">
						${latestSQLStats.n_plus_one_groups
							.map(
								(g) => `
							<li><strong>${g.count}x repeated</strong> (${g.total_ms}ms) from <code>${g.caller}</code></li>
						`
							)
							.join("")}
					</ul>
				</div>
			`;
		}

		if (!latestSQLStats.queries || latestSQLStats.queries.length === 0) {
			html += `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No database queries captured yet.</div>`;
		} else {
			html += latestSQLStats.queries
				.map(
					(q, idx) => `
				<div class="sauron-query-item ${q.is_n_plus_one ? "is-n1" : ""}">
					<div class="sauron-query-meta">
						<span class="sauron-query-caller">#${idx + 1} &middot; ${q.caller}</span>
						<div class="sauron-query-tags">
							${q.is_n_plus_one ? `<span class="sauron-tag-n1">DUPLICATE (${q.repeat_count}x)</span>` : ""}
							<span class="sauron-tag-ms ${q.is_slow ? "slow" : ""}">${q.duration_ms}ms</span>
						</div>
					</div>
					<div class="sauron-query-sql">${escapeHtml(q.query)}</div>
				</div>
			`
				)
				.join("");
		}

		body.innerHTML = html;
	}

	function escapeHtml(str) {
		return String(str)
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	}

	function updateActiveFormInspector() {
		const docTypeElem = document.getElementById("sauron-cur-doctype");
		const docNameElem = document.getElementById("sauron-cur-docname");
		if (!docTypeElem || !docNameElem) return;

		if (window.cur_frm && window.cur_frm.doctype) {
			docTypeElem.textContent = window.cur_frm.doctype;
			docNameElem.textContent = window.cur_frm.docname || "(New)";
			resolveDocTypeSource(window.cur_frm.doctype);
		} else {
			docTypeElem.textContent = "(No Active Form)";
			docNameElem.textContent = "-";
			currentResolvedFiles = null;
			disableCodeLinks();
		}
	}

	function resolveDocTypeSource(doctype) {
		if (typeof frappe === "undefined" || !frappe.call) return;
		frappe.call({
			method: "sauron.api.get_doctype_source",
			args: { doctype: doctype },
			callback: function (r) {
				if (r && r.message && r.message.found) {
					currentResolvedFiles = r.message.files;
					const preferredIDE = localStorage.getItem("sauron_preferred_ide") || "zed";
					applyCodeLinks(currentResolvedFiles, preferredIDE);
				} else {
					currentResolvedFiles = null;
					disableCodeLinks();
				}
			},
		});
	}

	function applyCodeLinks(files, ide) {
		setupCodeLink("sauron-link-py", files.py, ide);
		setupCodeLink("sauron-link-js", files.js, ide);
		setupCodeLink("sauron-link-json", files.json, ide);
	}

	function setupCodeLink(elemId, fileInfo, ide) {
		const elem = document.getElementById(elemId);
		if (!elem) return;
		if (fileInfo && fileInfo.exists) {
			let url = fileInfo.vscode_url;
			if (ide === "zed") {
				url = fileInfo.zed_url || `zed://file${fileInfo.path}`;
			} else if (ide === "cursor") {
				url = fileInfo.cursor_url || `cursor://file${fileInfo.path}`;
			} else if (ide === "vscode") {
				url = fileInfo.vscode_url || `vscode://file${fileInfo.path}`;
			}
			elem.href = url;
			elem.classList.remove("disabled");
			elem.title = `Open in ${ide.toUpperCase()}: ${fileInfo.path}`;
		} else {
			elem.removeAttribute("href");
			elem.classList.add("disabled");
		}
	}

	function disableCodeLinks() {
		["sauron-link-py", "sauron-link-js", "sauron-link-json"].forEach((id) => {
			const elem = document.getElementById(id);
			if (elem) {
				elem.removeAttribute("href");
				elem.classList.add("disabled");
			}
		});
	}

	// Listen to Frappe Route changes
	if (typeof $(document) !== "undefined") {
		$(document).on("page-change", function () {
			setTimeout(() => {
				updateActiveFormInspector();
				fetchLiveSQLStats();
				pollLiveLogs();
			}, 300);
		});
	}

	// Safe initialization hook on Frappe Desk boot
	function bootDevBar() {
		initDevBar();
		// Retry in 500ms and 1500ms in case Frappe Desk was still mounting
		setTimeout(initDevBar, 500);
		setTimeout(initDevBar, 1500);
	}

	if (typeof frappe !== "undefined" && frappe.ready) {
		frappe.ready(bootDevBar);
	} else if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", bootDevBar);
	} else {
		bootDevBar();
	}
})();
