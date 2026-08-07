"use client";

import { useState } from "react";
import { useT } from "@/components/I18nProvider";

interface TimedLog {
  time?: string;
  timestamp?: string;
  count?: number;
}
export interface ConsoleLog extends TimedLog {
  type: "console";
  level?: string;
  message?: string;
  text?: string;
}
export interface NetworkLog extends TimedLog {
  type: "network";
  level?: string;
  method?: string;
  status?: number;
  resourceType?: string;
  url?: string;
}
export interface ActionLog extends TimedLog {
  type: "step";
  message?: string;
}
export interface NavigationLog extends TimedLog {
  type: "navigation";
  message?: string;
  url?: string;
}
export interface ScreenshotLog extends TimedLog {
  type: "screenshot";
  message?: string;
  url?: string;
}
export type DevLog = ConsoleLog | NetworkLog | ActionLog | NavigationLog | ScreenshotLog;

// Compact health snapshot persisted by the extension (v1). Replaces the raw
// log array on the wire; legacy captures keep dev_logs as DevLog[].
export interface DevLogSummary {
  version: number;
  errors: number;
  warnings: number;
  failedRequests: number;
  topErrors?: string[];
  failedUrls?: string[];
}
export type CapturedLogs = DevLog[] | DevLogSummary | null;

function isSummary(logs: unknown): logs is DevLogSummary {
  return !!logs && typeof logs === "object" && typeof (logs as Record<string, unknown>).version === "number";
}

// Metadata is read as flat top-level capture fields (`os`, `browser`),
// matching how the extension stores them as columns. Null/undefined falls
// back to the placeholders below.
interface Props {
  capture: {
    drive_url: string;
    site_url?: string | null;
    created_at: string;
    window_size?: string | null;
    os?: string | null;
    browser?: string | null;
    dev_logs?: CapturedLogs;
  };
}

const TABS = ["Info", "Console", "Network", "Actions"] as const;
type Tab = typeof TABS[number];
type Grouped<T> = { log: T; count: number };

function normalizeText(value?: string) {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeLevel(level?: string) {
  const normalized = normalizeText(level) || "error";
  return normalized === "warning" ? "warn" : normalized;
}

function canonicalUrl(value?: string) {
  return (value || "").split("#", 1)[0];
}

function logCount(log: TimedLog) {
  return Math.max(1, Number(log.count) || 1);
}

function totalLogCount(items: TimedLog[]) {
  return items.reduce((total, log) => total + logCount(log), 0);
}

function consoleText(log: ConsoleLog) {
  return log.message || log.text || "";
}

function conciseConsoleText(log: ConsoleLog) {
  const lines = consoleText(log)
    .replace(/^\[console\]\s*Uncaught Exception:\s*/i, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const meaningful = lines.find((line, index) => index === 0 || !/(webpack|node_modules|react-dom|chrome-extension:|^at (?:__webpack|webpack))/i.test(line));
  return meaningful || lines[0] || "Console error";
}

function networkLocation(value?: string) {
  try {
    const url = new URL(value || "");
    return { domain: url.hostname, path: `${url.pathname}${url.search}` || "/" };
  } catch {
    return { domain: value || "—", path: "" };
  }
}

function groupBy<T extends TimedLog>(items: T[], keyFor: (item: T) => string, mapItem?: (item: T) => T): Grouped<T>[] {
  const groups = new Map<string, Grouped<T>>();
  items.forEach((item) => {
    const key = keyFor(item);
    const existing = groups.get(key);
    const itemCount = logCount(item);
    if (existing) existing.count += itemCount;
    else groups.set(key, { log: mapItem ? mapItem(item) : item, count: itemCount });
  });
  return Array.from(groups.values());
}

const TRACKER_PATTERNS = [
  /atlassian\.com/i,
  /google-analytics\.com/i,
  /googletagmanager\.com/i,
  /sentry\.io/i,
  /mixpanel\.com/i,
  /hotjar\.com/i,
  /amplitude\.com/i,
  /statsig\.com/i,
  /segment\.io/i,
  /doubleclick\.net/i,
  /facebook\.net/i,
  /analytics/i,
  /telemetry/i,
  /tracking/i
];

function isTracker(url?: string) {
  if (!url) return false;
  return TRACKER_PATTERNS.some((pattern) => pattern.test(url));
}

export default function DevToolsPanel({ capture }: Props) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<Tab>("Info");
  const [logSearch, setLogSearch] = useState("");
  const [showErrorsOnly, setShowErrorsOnly] = useState(false);

  // New captures ship a compact health summary; legacy captures carry a raw
  // array. Normalize both to an array so every downstream filter/tab just
  // works. A clean page stores ~0 bytes (summary is null) → empty arrays.
  const summaryOnly = !Array.isArray(capture.dev_logs) && isSummary(capture.dev_logs);
  const logs: DevLog[] = Array.isArray(capture.dev_logs)
    ? capture.dev_logs
    : isSummary(capture.dev_logs)
      ? []
      : [];
  const summary = summaryOnly ? (capture.dev_logs as DevLogSummary) : null;

  const earliestTimestamp = logs.reduce((min, log) => {
    const ts = new Date(log.time || log.timestamp || "").getTime();
    if (Number.isFinite(ts) && (min === 0 || ts < min)) return ts;
    return min;
  }, 0);

  const getRelativeTime = (log: TimedLog) => {
    const value = log.time || log.timestamp;
    if (!value) return "—";
    if (/^[+\d].*(?:ms|s|m|h)$/i.test(value)) return value;
    const ts = new Date(value).getTime();
    if (!Number.isFinite(ts) || earliestTimestamp === 0) return "—";
    const elapsed = ts - earliestTimestamp;
    if (elapsed < 1000) return `${Math.max(0, elapsed)}ms`;
    if (elapsed < 60000) return `${(elapsed / 1000).toFixed(1)}s`;
    return `${Math.floor(elapsed / 60000)}m ${Math.floor((elapsed % 60000) / 1000)}s`;
  };
  
  const networkLogs = logs
    .filter((l): l is NetworkLog => l.type === "network")
    .filter((l) => {
      if (isTracker(l.url)) return false;
      const matchesQuery = !logSearch || (l.url || "").toLowerCase().includes(logSearch.toLowerCase());
      const isErr = !l.status || l.status >= 400 || normalizeLevel(l.level) === "error";
      const matchesError = !showErrorsOnly || isErr;
      return matchesQuery && matchesError;
    });

  const eventTime = (log: TimedLog) => log.time || log.timestamp || "";

  const consoleLogs = logs
    .filter((log) => log.type === "console" || log.type === "navigation" || log.type === "screenshot")
    .filter((log) => {
      if (log.type === "console") {
        const level = normalizeLevel(log.level);
        if (level !== "error" && level !== "warn") return false;
      }
      const detail = log.type === "console" ? consoleText(log)
        : log.message || ("url" in log ? log.url : "") || "";
      if (isTracker(detail) || ("url" in log && isTracker(log.url))) return false;
      const isError = log.type === "console" ? normalizeLevel(log.level) === "error" : false;
      return (!logSearch || detail.toLowerCase().includes(logSearch.toLowerCase())) && (!showErrorsOnly || isError);
    });

  const actionLogs = logs
    .filter((l): l is ActionLog | NavigationLog => l.type === "step" || l.type === "navigation")
    .filter((l) => !logSearch || `${l.message || ""} ${"url" in l ? l.url || "" : ""}`.toLowerCase().includes(logSearch.toLowerCase()));
  const groupedNetworkLogs = groupBy(
    networkLogs,
    (log) => `${(log.method || "GET").toUpperCase()}\u0000${log.status ?? "FAILED"}\u0000${canonicalUrl(log.url)}`,
    (log) => ({ ...log, url: canonicalUrl(log.url) }),
  );

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
    md += `| **URL** | ${capture.site_url ? `[Open link](${capture.site_url})` : "-"} |\n`;
    md += `| **OS** | ${detectedOs} |\n`;
    md += `| **Browser** | ${detectedBrowser} |\n`;
    md += `| **Window size** | ${capture.window_size || "-"} |\n`;
    md += `| **Recorded at** | ${createdAt} |\n\n`;

    if (consoleLogs.length > 0) {
      md += `### Diagnostic Timeline (${totalLogCount(consoleLogs)})\n\`\`\`text\n`;
      consoleLogs.forEach((log) => {
        const detail = log.type === "console" ? log.message || log.text || "" : log.message || ("url" in log ? log.url : "") || (log.type === "screenshot" ? "Screenshot taken" : "Navigation");
        md += `[${log.type.toUpperCase()}] ${eventTime(log)} ${detail}${(log.count || 1) > 1 ? ` ×${log.count}` : ""}\n`;
      });
      md += `\`\`\`\n\n`;
    }

    if (networkLogs.length > 0) {
      md += `### 🌐 Network Errors (${totalLogCount(networkLogs)})\n| Method | Status | Type | URL |\n| :--- | :--- | :--- | :--- |\n`;
      groupedNetworkLogs.forEach(({ log, count }) => {
        md += `| ${log.method || "GET"} | ${log.status || "FAILED"} | ${log.resourceType || "xhr"} | ${log.url || ""}${count > 1 ? ` ×${count}` : ""} |\n`;
      });
      md += `\n`;
    }

    if (actionLogs.length > 0) {
      md += `### User Actions Timeline\n`;
      actionLogs.forEach((log) => {
        md += `- **${eventTime(log)}**: ${log.type === "navigation" ? `Navigate to ${log.url || log.message || ""}` : log.message || ""}\n`;
      });
      md += `\n`;
    }

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  }

  const tabLabel = (tab: Tab) => {
    if (tab === "Console" && consoleLogs.length) return `${t("dt.console")} (${totalLogCount(consoleLogs)})`;
    if (tab === "Network" && networkLogs.length) return `${t("dt.network")} (${totalLogCount(networkLogs)})`;
    if (tab === "Actions" && actionLogs.length)  return `${t("dt.actions")} (${totalLogCount(actionLogs)})`;
    return t(`dt.${tab.toLowerCase()}`);
  };

  return (
    <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-border bg-white flex flex-col shrink-0 h-[450px] lg:h-auto min-h-0 max-h-full">
      {/* Header */}
      <div className="h-11 border-b border-border px-4 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-foreground">{t("v.devTools")}</span>
        <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
          {summary ? (summary.errors === 0 && summary.warnings === 0 && summary.failedRequests === 0 ? t("dt.clean", { n: 0 }) : t("dt.events", { n: summary.errors + summary.warnings + summary.failedRequests }))
            : t("dt.events", { n: totalLogCount(consoleLogs) + totalLogCount(networkLogs) + totalLogCount(actionLogs) })}
        </span>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border shrink-0 px-4 gap-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-2 py-2.5 text-[11px] font-medium relative transition-colors whitespace-nowrap ${
              activeTab === t ? "text-indigo-600" : "text-muted hover:text-foreground"
            }`}
          >
            {tabLabel(t)}
            {activeTab === t && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
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
                placeholder={t("dt.search", { tab: tabLabel(activeTab) })}
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border text-xs bg-white outline-none focus:border-indigo-500"
              />
            </div>
            {(activeTab === "Console" || activeTab === "Network") && (
              <div className="flex bg-border/50 p-0.5 rounded-lg shrink-0">
                <button
                  type="button"
                  onClick={() => setShowErrorsOnly(false)}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-semibold rounded-md transition-colors ${
                    !showErrorsOnly ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
                  }`}
                >
                  {t("dt.all")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowErrorsOnly(true)}
                  className={`flex-1 px-3 py-1.5 text-[10px] font-semibold rounded-md transition-colors flex items-center justify-center gap-1 ${
                    showErrorsOnly ? "bg-red-50 text-red-600 shadow-sm border border-red-100" : "text-muted hover:text-red-500"
                  }`}
                >
                  {t("dt.errorsOnly")}
                </button>
              </div>
            )}
          </div>
        )}

        {/* INFO TAB */}
        {activeTab === "Info" && (
          <div className="p-4 space-y-4">

            {/* URL */}
            {capture.site_url && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">URL</p>
                <a
                  href={capture.site_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-[11px] font-mono text-indigo-600 hover:underline bg-subtle/60 border border-border rounded-lg px-2.5 py-2 truncate"
                >
                  {capture.site_url}
                </a>
              </div>
            )}

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
                  labelKey: "dt.timestamp",
                  value: createdAt,
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
                    </svg>
                  ),
                  labelKey: "dt.location",
                  value: "Indonesia",
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  ),
                  labelKey: "dt.os",
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
                  labelKey: "dt.browser",
                  value: detectedBrowser,
                },
                {
                  icon: (
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="13" rx="2"/>
                      <path d="M12 16v5M8 21h8"/>
                    </svg>
                  ),
                  labelKey: "dt.windowSize",
                  value: capture.window_size || "-",
                },
              ].map((row) => (
                <div key={row.labelKey} className="flex items-center justify-between px-3 py-2 border-b border-border/60 last:border-0">
                  <div className="flex items-center gap-2 text-muted">
                    {row.icon}
                    <span className="text-xs">{t(row.labelKey)}</span>
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
                {copiedMd ? t("dt.copiedReport") : t("dt.copyReport")}
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
                {t("dt.downloadJson")}
              </button>
            </div>
          </div>
        )}

        {/* CONSOLE TAB */}
        {activeTab === "Console" && (
          <div>
            {consoleLogs.length === 0 ? (
              summary ? (
                <div className="px-4 py-5 space-y-3">
                  {summary.errors === 0 && summary.warnings === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-center text-xs text-muted">
                      <svg className="w-8 h-8 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <p className="font-medium text-emerald-700">{t("dt.pageRanClean")}</p>
                      <p className="text-[11px]">{t("dt.noConsoleErrors")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                        <span className="text-lg font-bold text-red-600">{summary.errors}</span>
                        <span className="text-xs text-red-700">{summary.errors === 1 ? t("dt.consoleErrOne") : t("dt.consoleErr")}</span>
                        {summary.warnings > 0 && (
                          <span className="text-[10px] ml-auto text-amber-700">{t("dt.warnSuffix", { n: summary.warnings })}</span>
                        )}
                      </div>
                      {(summary.topErrors || []).map((msg, i) => (
                        <p key={i} className="text-[11px] leading-4 text-foreground/90 border-b border-border/50 pb-1.5">{msg}</p>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="py-14 text-center text-xs text-muted">{t("dt.noConsoleEvents")}</div>
              )
            ) : consoleLogs.map((log, i) => {
              const level = log.type === "console" ? normalizeLevel(log.level) : log.type;
              const isWarn = level === "warn";
              const detail = log.type === "console" ? conciseConsoleText(log)
                : log.message || ("url" in log ? log.url : "") || (log.type === "screenshot" ? t("dt.screenshotTaken") : t("dt.navigation"));
              const fullText = log.type === "console" ? consoleText(log) : detail;
              return (
                <div key={i} className={`grid grid-cols-[42px_18px_minmax(0,1fr)_auto] gap-1.5 border-b border-border/70 px-2 py-1.5 text-xs ${isWarn ? "bg-amber-50/60" : level === "error" ? "bg-red-50/60" : "bg-white"}`}>
                  <time className="pt-0.5 text-[9px] tabular-nums text-muted" title={eventTime(log)}>{getRelativeTime(log)}</time>
                  <span className={`pt-0.5 text-center font-bold ${isWarn ? "text-amber-600" : level === "error" ? "text-red-600" : "text-muted"}`} aria-label={level === "error" ? t("dt.consoleError") : `${level} event`} title={level}>{isWarn ? "!" : level === "error" ? "×" : "•"}</span>
                  <p className="min-w-0 overflow-hidden text-ellipsis break-words leading-4 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]" title={fullText}>{detail}</p>
                  {logCount(log) > 1 && <span className="text-[9px] font-semibold text-muted" aria-label={t("dt.repeated", { n: logCount(log) })}>×{logCount(log)}</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* NETWORK TAB */}
        {activeTab === "Network" && (
          <div className="overflow-x-auto">
            {networkLogs.length === 0 ? (
              summary ? (
                <div className="px-4 py-5 space-y-3">
                  {summary.failedRequests === 0 ? (
                    <div className="py-10 flex flex-col items-center gap-2 text-center text-xs text-muted">
                      <svg className="w-8 h-8 text-emerald-500/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                      <p className="font-medium text-emerald-700">{t("dt.noFailedRequests")}</p>
                      <p className="text-[11px]">{t("dt.allNetworkOk")}</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                        <span className="text-lg font-bold text-red-600">{summary.failedRequests}</span>
                        <span className="text-xs text-red-700">{summary.failedRequests === 1 ? t("dt.failedReqOne") : t("dt.failedReq")}</span>
                      </div>
                      {(summary.failedUrls || []).map((url, i) => (
                        <p key={i} className="truncate text-[11px] font-mono text-foreground/80 border-b border-border/50 pb-1.5" title={url}>{url}</p>
                      ))}
                    </>
                  )}
                </div>
              ) : (
                <div className="py-14 text-center text-xs text-muted">{t("dt.noNetworkErrors")}</div>
              )
            ) : (
              <table className="w-full min-w-[350px] table-fixed text-left text-[10px]" aria-label={t("dt.network")}>
                <thead className="sticky top-0 z-10 bg-subtle text-[9px] uppercase tracking-wide text-muted">
                  <tr><th className="w-14 px-2 py-1.5 font-semibold">{t("dt.method")}</th><th className="w-14 px-1 py-1.5 font-semibold">{t("dt.status")}</th><th className="w-14 px-1 py-1.5 font-semibold">{t("dt.type")}</th><th className="px-1 py-1.5 font-semibold">{t("dt.domain")}</th></tr>
                </thead>
                <tbody>
                  {groupedNetworkLogs.map(({ log, count }, i) => {
                    const { domain, path } = networkLocation(log.url);
                    const fullLocation = log.url || domain;
                    return (
                      <tr key={i} className="group border-b border-border/70 hover:bg-subtle/60">
                        <td className="px-2 py-1.5 font-mono font-semibold uppercase">{log.method || "GET"}</td>
                        <td className={`px-1 py-1.5 font-mono font-semibold ${!log.status || log.status >= 400 ? "text-red-600" : log.status < 300 ? "text-emerald-600" : "text-amber-700"}`}>{log.status || "FAILED"}</td>
                        <td className="truncate px-1 py-1.5 text-muted" title={log.resourceType || "xhr"}>{log.resourceType || "xhr"}</td>
                        <td className="min-w-0 px-1 py-1.5" title={fullLocation}>
                          <div className="flex min-w-0 items-center gap-1">
                            <span className="truncate font-medium">{domain}</span>
                            {count > 1 && <span className="shrink-0 font-semibold text-muted" aria-label={t("dt.repeated", { n: count })}>×{count}</span>}
                          </div>
                          {path && <div className="truncate font-mono text-[9px] text-muted">{path}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
                <p className="text-xs">{t("dt.noActions")}</p>
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
                            {eventTime(log) && <span className="text-[10px] text-muted font-mono">{getRelativeTime(log)}</span>}
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">{log.type === "navigation" ? t("dt.navigateTo", { url: log.url || log.message || "" }) : log.message || ""}</p>
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
