"use client";

import { useState } from "react";

export interface ConsoleLog {
  type: "console";
  level?: string;
  time?: string;
  message?: string;
  text?: string;
}
export interface NetworkLog {
  type: "network";
  method?: string;
  status?: number;
  resourceType?: string;
  url?: string;
}
export interface ActionLog {
  type: "step";
  time?: string;
  message?: string;
}
export type DevLog = ConsoleLog | NetworkLog | ActionLog;

// Metadata is read as flat top-level capture fields (`os`, `browser`),
// matching how the extension stores them as columns on captures.
// Null/undefined falls back to the placeholders below.
interface Props {
  capture: {
    drive_url: string;
    created_at: string;
    window_size?: string | null;
    os?: string | null;
    browser?: string | null;
    dev_logs?: DevLog[] | null;
  };
}

const TABS = ["Info", "Console", "Network", "Actions"] as const;
type Tab = typeof TABS[number];

export default function DevToolsPanel({ capture }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Info");
  const [logSearch, setLogSearch] = useState("");
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  const logs = Array.isArray(capture.dev_logs) ? capture.dev_logs : [];
  
  const consoleLogs = logs
    .filter((l): l is ConsoleLog => l.type === "console")
    .filter((l) => {
      const msg = (l.message || l.text || "").toLowerCase();
      const matchesQuery = !logSearch || msg.includes(logSearch.toLowerCase());
      const isError = l.level !== "warn" && l.level !== "warning";
      const matchesError = !showErrorsOnly || isError;
      return matchesQuery && matchesError;
    });

  const networkLogs = logs
    .filter((l): l is NetworkLog => l.type === "network")
    .filter((l) => {
      const matchesQuery = !logSearch || (l.url || "").toLowerCase().includes(logSearch.toLowerCase());
      const isErr = !l.status || l.status >= 400;
      const matchesError = !showErrorsOnly || isErr;
      return matchesQuery && matchesError;
    });

  const actionLogs  = logs
    .filter((l): l is ActionLog  => l.type === "step")
    .filter((l) => !logSearch || (l.message || "").toLowerCase().includes(logSearch.toLowerCase()));

  // Format like: "July 8, 2026 at 4:55 PM GMT+7"
  const createdAt = new Date(capture.created_at).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", timeZoneName: "short",
  });

  // Smart fallback for legacy metadata (pre-migration captures)
  const legacyLogsText = JSON.stringify(capture.dev_logs || []);
  const detectedOs = capture.os || (legacyLogsText.toLowerCase().includes("macintosh") || legacyLogsText.toLowerCase().includes("mac os") ? "macOS" : "Windows");
  const detectedBrowser = capture.browser || "Chrome";

  const [copiedMd, setCopiedMd] = useState(false);

  function downloadJson() {
    const blob = new Blob([JSON.stringify(capture.dev_logs, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "capture_logs.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function copyToMarkdown() {
    let md = `## 🐞 Mazway Bug Report: ${createdAt}\n\n`;
    
    md += `### 💻 System Info\n`;
    md += `| Field | Value |\n`;
    md += `| :--- | :--- |\n`;
    md += `| **URL** | [Open link](${capture.drive_url}) |\n`;
    md += `| **OS** | ${detectedOs} |\n`;
    md += `| **Browser** | ${detectedBrowser} |\n`;
    md += `| **Window size** | ${capture.window_size || "-"} |\n`;
    md += `| **Recorded at** | ${createdAt} |\n\n`;

    if (consoleLogs.length > 0) {
      md += `### 🛑 Console Logs (${consoleLogs.length})\n\`\`\`bash\n`;
      consoleLogs.forEach((log) => {
        md += `[${(log.level || "ERROR").toUpperCase()}] ${log.time || ""} ${log.message || log.text || ""}\n`;
      });
      md += `\`\`\`\n\n`;
    }

    if (networkLogs.length > 0) {
      md += `### 🌐 Network Errors (${networkLogs.length})\n| Method | Status | Type | URL |\n| :--- | :--- | :--- | :--- |\n`;
      networkLogs.forEach((log) => {
        md += `| ${log.method || "GET"} | ${log.status || "FAILED"} | ${log.resourceType || "xhr"} | ${log.url || ""} |\n`;
      });
      md += `\n`;
    }

    if (actionLogs.length > 0) {
      md += `### 🖱️ User Actions Timeline\n`;
      actionLogs.forEach((log) => {
        md += `- **${log.time || ""}**: ${log.message || ""}\n`;
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  }

  const tabLabel = (t: Tab) => {
    if (t === "Console" && consoleLogs.length) return `Console (${consoleLogs.length})`;
    if (t === "Network" && networkLogs.length) return `Network (${networkLogs.length})`;
    if (t === "Actions" && actionLogs.length)  return `Actions (${actionLogs.length})`;
    return t;
  };

  return (
    <div className="w-full lg:w-[360px] border-l border-border bg-white flex flex-col shrink-0 min-h-0 max-h-full">
      {/* Header */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-foreground">DevTools</span>
        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          {logs.length} events
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0 px-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-3 py-2.5 text-[11px] font-medium relative transition-colors whitespace-nowrap ${
              activeTab === t ? "text-indigo-600" : "text-muted hover:text-foreground"
            }`}
          >
            {tabLabel(t)}
            {activeTab === t && (
              <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-indigo-600 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content — scrolls when logs overflow the panel */}
      <div className="flex-1 overflow-y-auto min-h-0">

        {/* Global Tab Search & Filters (Shown for Console, Network, Actions) */}
        {activeTab !== "Info" && (
          <div className="p-3 border-b border-border bg-subtle/40 flex flex-col gap-2 shrink-0">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
              </svg>
              <input
                type="text"
                placeholder={`Search ${activeTab.toLowerCase()}...`}
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border text-xs bg-white outline-none focus:border-indigo-500"
              />
            </div>
            {(activeTab === "Console" || activeTab === "Network") && (
              <label className="flex items-center gap-2 text-[10px] text-muted cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showErrorsOnly}
                  onChange={(e) => setShowErrorsOnly(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-border text-indigo-600 focus:ring-indigo-500"
                />
                Show Errors Only
              </label>
            )}
          </div>
        )}

        {/* INFO TAB */}
        {activeTab === "Info" && (
          <div className="p-4 space-y-4">

            {/* URL */}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">URL</p>
              <a
                href={capture.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-[11px] font-mono text-indigo-600 hover:underline bg-subtle/60 border border-border rounded-lg px-2.5 py-2 truncate"
              >
                {capture.drive_url}
              </a>
            </div>

            {/* Device Card (Jam.dev style) */}
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Info rows */}
              {[
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                    </svg>
                  ),
                  label: "Timestamp",
                  value: createdAt,
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                  ),
                  label: "Location",
                  value: "Indonesia",
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  ),
                  label: "OS",
                  value: detectedOs,
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/>
                      <line x1="21.17" y1="8" x2="12" y2="8"/><line x1="3.95" y1="6.06" x2="8.54" y2="14"/>
                      <line x1="10.88" y1="21.94" x2="15.46" y2="14"/>
                    </svg>
                  ),
                  label: "Browser",
                  value: detectedBrowser,
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="13" rx="2"/>
                      <path d="M12 16v5M8 21h8"/>
                    </svg>
                  ),
                  label: "Window size",
                  value: capture.window_size || "-",
                },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between px-3 py-2 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2 text-muted">
                    {row.icon}
                    <span className="text-xs">{row.label}</span>
                  </div>
                  <span className="text-xs font-medium text-foreground">{row.value}</span>
                </div>
              ))}
            </div>

            {/* Action Buttons (moved below info card) */}
            <div className="space-y-2">
              <button
                onClick={copyToMarkdown}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                {copiedMd ? "Copied Report!" : "Copy Report for Jira/GitHub"}
              </button>
              <button
                onClick={downloadJson}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border bg-white hover:bg-subtle text-foreground text-xs font-semibold shadow-sm transition-colors"
              >
                <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download JSON
              </button>
            </div>
          </div>
        )}

        {/* CONSOLE TAB */}
        {activeTab === "Console" && (
          <div className="p-3 space-y-1.5">
            {consoleLogs.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-muted">
                <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-xs">No console errors recorded</p>
              </div>
            ) : (
              consoleLogs.map((log, i) => {
                const isWarn = log.level === "warn" || log.level === "warning";
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs font-mono ${
                    isWarn
                      ? "bg-amber-50 border-amber-100 text-amber-900"
                      : "bg-red-50 border-red-100 text-red-900"
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        isWarn ? "bg-amber-200 text-amber-800" : "bg-red-200 text-red-800"
                      }`}>
                        {isWarn ? "WARN" : "ERROR"}
                      </span>
                      {log.time && <span className="text-[10px] text-muted font-sans">{log.time}</span>}
                    </div>
                    <p className="break-all leading-relaxed">{log.message || log.text || ""}</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === "Network" && (
          <div className="p-3 space-y-1.5">
            {networkLogs.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-muted">
                <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                </svg>
                <p className="text-xs">No network errors recorded</p>
              </div>
            ) : (
              networkLogs.map((log, i) => {
                const isErr = !log.status || log.status >= 400;
                let domain = "";
                let path = log.url || "";
                try { const u = new URL(log.url!); domain = u.hostname; path = u.pathname + u.search; } catch {}
                return (
                  <div key={i} className={`rounded-lg border px-3 py-2 text-xs font-mono group relative ${
                    isErr ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold uppercase bg-foreground/10 px-1.5 py-0.5 rounded text-foreground">
                          {log.method || "GET"}
                        </span>
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${
                          isErr ? "bg-red-200 text-red-800" : "bg-amber-200 text-amber-800"
                        }`}>
                          {log.status || "FAILED"}
                        </span>
                        {log.resourceType && (
                          <span className="text-[9px] text-muted">{log.resourceType}</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          const curl = `curl -X ${log.method || "GET"} "${log.url}"`;
                          navigator.clipboard.writeText(curl);
                          const btn = document.getElementById(`curl-btn-${i}`);
                          if (btn) {
                            btn.innerHTML = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
                            setTimeout(() => {
                              btn.innerHTML = '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>';
                            }, 1500);
                          }
                        }}
                        id={`curl-btn-${i}`}
                        title="Copy as cURL"
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/5 text-muted hover:text-foreground transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-[10px] text-muted font-sans pr-6">{domain}</p>
                    <p className="break-all text-foreground pr-6">{path}</p>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ACTIONS TAB */}
        {activeTab === "Actions" && (
          <div className="p-3">
            {actionLogs.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-2 text-muted">
                <svg className="w-8 h-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
                </svg>
                <p className="text-xs">No user actions recorded</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />
                <div className="space-y-1">
                  {actionLogs.map((log, i) => {
                    const isClick = (log.message || "").toLowerCase().includes("click");
                    const isType  = (log.message || "").toLowerCase().includes("type") || (log.message || "").toLowerCase().includes("input");
                    return (
                      <div key={i} className="flex items-start gap-3 pl-0.5">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white ${
                          isClick ? "bg-indigo-100" : isType ? "bg-emerald-100" : "bg-subtle"
                        }`}>
                          {isClick ? (
                            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"/>
                            </svg>
                          ) : isType ? (
                            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="4"/>
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 pb-3">
                          <div className="flex items-center gap-2">
                            {log.time && <span className="text-[10px] text-muted font-mono">{log.time}</span>}
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{log.message || ""}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
