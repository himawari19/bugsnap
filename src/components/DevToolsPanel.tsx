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

// Metadata is read as flat top-level capture fields (`os`, `browser`,
// `location`), matching how the extension stores them as columns on
// captures. Null/undefined falls back to the placeholders below.
interface Props {
  capture: {
    drive_url: string;
    created_at: string;
    window_size?: string | null;
    os?: string | null;
    browser?: string | null;
    location?: string | null;
    dev_logs?: DevLog[] | null;
  };
}

const TABS = ["Info", "Console", "Network", "Actions"] as const;
type Tab = typeof TABS[number];

export default function DevToolsPanel({ capture }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Info");

  const logs = Array.isArray(capture.dev_logs) ? capture.dev_logs : [];
  const consoleLogs = logs.filter((l): l is ConsoleLog => l.type === "console");
  const networkLogs = logs.filter((l): l is NetworkLog => l.type === "network");
  const actionLogs  = logs.filter((l): l is ActionLog  => l.type === "step");

  const createdAt = new Date(capture.created_at).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });

  const tabLabel = (t: Tab) => {
    if (t === "Console" && consoleLogs.length) return `Console (${consoleLogs.length})`;
    if (t === "Network" && networkLogs.length) return `Network (${networkLogs.length})`;
    if (t === "Actions" && actionLogs.length)  return `Actions (${actionLogs.length})`;
    return t;
  };

  return (
    <div className="w-[360px] border-l border-border bg-white flex flex-col shrink-0 h-full">
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto">

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
              {/* Window Size Banner */}
              <div className="bg-subtle/60 px-3 py-2 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">Window Size</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {capture.window_size || "—"}
                </span>
              </div>

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
                  value: capture.location || "—", // not captured by extension yet; shows empty dash instead of fake data
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  ),
                  label: "OS",
                  value: capture.os || "Unknown",
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
                  value: capture.browser || "Unknown",
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
