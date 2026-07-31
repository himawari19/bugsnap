"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface DevLog {
  type?: string;
  level?: string;
  message?: string;
  text?: string;
  time?: string;
  timestamp?: number;
  url?: string;
  method?: string;
  status?: number;
  statusText?: string;
  duration?: number;
  resourceType?: string;
}

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  dev_logs: DevLog[] | null;
}

function GoogleDriveViewer({ url, type }: { url: string; type: string }) {
  let embedVideoUrl = url;
  if (type === "video") {
    // Extract Google Drive File ID if present
    const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      embedVideoUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {type === "video" ? (
        <div className="w-full flex flex-col items-center gap-3">
          <video
            id="main-video-player"
            src={embedVideoUrl}
            controls
            playsInline
            preload="metadata"
            className="w-full max-w-3xl rounded-lg border border-border bg-black shadow-sm"
          />
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted hover:text-foreground flex items-center gap-1 mt-1"
          >
            Open in Google Drive
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
          </a>
        </div>
      ) : (
        <div className="w-full max-w-3xl rounded-lg border border-border bg-subtle/40 p-8 flex flex-col items-center gap-4">
          <svg className="w-14 h-14 text-indigo-600/70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm text-muted text-center">
            This is a screenshot capture. Open it in Google Drive to view the full image.
          </p>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
          >
            Open in Drive
            <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
            </svg>
          </a>
        </div>
      )}
    </div>
  );
}

function DevToolsPanel({ logs }: { logs: DevLog[] }) {
  const [activeTab, setActiveTab] = useState<"info" | "console" | "network" | "actions">("info");
  const [copied, setCopied] = useState(false);

  const sortedLogs = [...logs].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
  const consoleLogs = logs.filter((l) => l.type === "console");
  const networkLogs = logs.filter((l) => l.type === "network");
  const actionLogs = logs.filter((l) => l.type === "step");

  const firstLog = sortedLogs[0];
  const infoTimestamp = firstLog?.timestamp
    ? new Date(firstLog.timestamp).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).replace(", ", " at ")
    : null;

  async function copyLogs() {
    await navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const tabs: { id: "info" | "console" | "network" | "actions"; label: string; count: number; dot?: string }[] = [
    { id: "info", label: "Info", count: 0 },
    { id: "console", label: "Console", count: consoleLogs.length, dot: "bg-amber-500" },
    { id: "network", label: "Network", count: networkLogs.length, dot: "bg-red-500" },
    { id: "actions", label: "Actions", count: 0 },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
        <span className="text-sm font-semibold text-foreground">DevTools</span>
        <button
          onClick={copyLogs}
          className="text-xs font-medium text-muted hover:text-foreground border border-border rounded-md px-2.5 py-1 hover:bg-subtle transition-colors"
        >
          {copied ? "Copied!" : "Copy Logs"}
        </button>
      </div>

      {/* Tabs — exact match of extension DevTools tabs */}
      <div className="flex gap-4 px-5 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative py-2.5 text-[13px] font-medium transition-colors flex items-center gap-1.5 ${
              activeTab === tab.id
                ? "text-indigo-600 font-semibold after:content-[''] after:absolute after:bottom-[-1px] after:left-0 after:right-0 after:h-0.5 after:bg-indigo-600 after:rounded-t"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
            {tab.count > 0 && tab.dot && (
              <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
            )}
          </button>
        ))}
      </div>

      {/* Panes */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* INFO */}
        {activeTab === "info" && (
          <div>
            {[
              ["Timestamp", infoTimestamp ?? "Not recorded"],
              ["OS", "Not recorded"],
              ["Browser", "Not recorded"],
              ["Window size", "—"],
            ].map(([label, val]) => (
              <div key={label} className="flex items-center mb-4">
                <div className="w-[100px] shrink-0 text-[13px] text-muted">{label}</div>
                <div className="flex-1 text-[13px] text-neutral-800 font-medium break-words">{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* CONSOLE */}
        {activeTab === "console" && (
          <div>
            {consoleLogs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted">No console errors recorded.</div>
            ) : (
              consoleLogs.map((log, i) => {
                const isWarn = log.level === "warn" || log.level === "warning";
                return (
                  <div
                    key={i}
                    className={`py-1.5 px-1.5 border-b border-border flex gap-2 font-mono text-xs break-all ${
                      isWarn
                        ? "bg-amber-50/60 text-amber-700"
                        : "bg-red-50/60 text-red-700"
                    }`}
                  >
                    <span className="text-muted min-w-[35px] shrink-0">{log.time || ""}</span>
                    <span>{log.message || log.text || ""}</span>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* NETWORK */}
        {activeTab === "network" && (
          <div className="overflow-x-auto">
            {networkLogs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted">No network errors recorded.</div>
            ) : (
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    {["Method", "Status", "Type", "Domain", "Name/Path"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-1.5 py-2 border-b border-border text-muted font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {networkLogs.map((log, i) => {
                    const isErr = (log.status ?? 0) >= 500 || log.status === 0 || !log.status;
                    let domain = "";
                    let path = log.url || "";
                    try {
                      const parsed = new URL(log.url as string);
                      domain = parsed.hostname;
                      path = parsed.pathname + parsed.search;
                    } catch {}
                    return (
                      <tr
                        key={i}
                        className={isErr ? "bg-red-50/60 text-red-700" : "bg-amber-50/60 text-amber-700"}
                      >
                        <td className="px-1.5 py-2 border-b border-border font-mono">
                          <span className="font-semibold">{log.method || "GET"}</span>
                        </td>
                        <td className="px-1.5 py-2 border-b border-border font-mono">
                          {String(log.status ?? "FAILED")}
                        </td>
                        <td className="px-1.5 py-2 border-b border-border font-mono">
                          {log.resourceType || "xhr"}
                        </td>
                        <td className="px-1.5 py-2 border-b border-border font-mono">{domain}</td>
                        <td className="px-1.5 py-2 border-b border-border font-mono break-all" title={log.url}>
                          {path}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ACTIONS */}
        {activeTab === "actions" && (
          <div>
            {actionLogs.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-muted">No user actions recorded.</div>
            ) : (
              actionLogs.map((log, i) => {
                const isClick = (log.message || "").toLowerCase().includes("click");
                return (
                  <div
                    key={i}
                    className="flex gap-3 py-2 border-b border-border font-mono text-xs"
                  >
                    <span className="text-muted min-w-[35px]">{log.time || "00:00"}</span>
                    <span className="text-muted shrink-0">
                      {isClick ? (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M13 10h-3V3L4 14h3v8l6-11z" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                          <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-3 12H7v-2h10v2zm0-4H7v-2h10v2z" />
                        </svg>
                      )}
                    </span>
                    <span className="text-indigo-600">{log.message || ""}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ViewCapturePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [capture, setCapture] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  async function copyEmbedCode() {
    const embedCode = `<iframe src="${window.location.origin}/view/${id}" width="100%" height="480" style="border:0;border-radius:12px" allowfullscreen></iframe>`;
    try {
      await navigator.clipboard.writeText(embedCode);
    } catch {
      window.prompt("Copy embed code:", embedCode);
    }
    setEmbedCopied(true);
    setTimeout(() => setEmbedCopied(false), 1500);
  }

  useEffect(() => {
    let cancelled = false;
    async function fetchCapture() {
      setLoading(true);
      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .or(`id.eq.${id},drive_url.eq.${id}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn("Error fetching capture:", error);
        if (!cancelled) {
          setError("Could not load this capture.");
          setLoading(false);
        }
        return;
      }
      if (!cancelled) {
        setCapture(data as Capture | null);
        setLoading(false);
      }
    }
    fetchCapture();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function copyLink() {
    const link = `${window.location.origin}/view/${id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard API can fail in non-secure contexts; fall back to a prompt.
      window.prompt("Copy this link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Top navbar */}
      <header className="border-b border-border bg-white sticky top-0 z-10">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-5 py-3.5">
          <Link href="/" className="flex items-center gap-2.5">
            <svg viewBox="0 0 128 128" className="w-7 h-7" aria-hidden="true">
              <rect x="8" y="8" width="112" height="112" rx="27" fill="url(#lgn)" />
              <defs>
                <linearGradient id="lgn" x1="14" y1="12" x2="114" y2="118" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#18B7E9" />
                  <stop offset=".54" stopColor="#4C8BF0" />
                  <stop offset="1" stopColor="#8A42E8" />
                </linearGradient>
              </defs>
              <circle cx="64" cy="64" r="38" fill="#FFF" />
              <circle cx="64" cy="64" r="28" fill="#27AEBB" />
              <circle cx="64" cy="64" r="12" fill="#FFF" />
              <circle cx="64" cy="64" r="5" fill="#5B61DA" />
            </svg>
            <span className="text-lg font-bold tracking-tight">Mazway</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={copyLink}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              {copied ? "Copied!" : "Copy Link"}
            </button>
            <button
              onClick={copyEmbedCode}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              {embedCopied ? "Embed Copied!" : "Copy Embed"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-7xl px-5 py-6 flex flex-col">
        {loading ? (
          <div className="py-24 text-center text-sm text-muted">Loading capture...</div>
        ) : error || !capture ? (
          <div className="py-24 text-center">
            <svg className="w-12 h-12 mx-auto text-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">Capture not found</h1>
            <p className="text-sm text-muted mt-1 max-w-sm mx-auto">
              The link you opened doesn&apos;t match any capture in this workspace.
            </p>
          </div>
        ) : (
          <>
            {/* Identity / metadata header */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  {(capture.title || "U").charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-foreground truncate">
                    {capture.title || "Untitled"}
                  </h1>
                  <p className="text-xs text-muted">
                    {new Date(capture.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                    {" · "}
                    {capture.type === "video" ? "Screen recording" : "Screenshot"}
                    {capture.window_size ? ` · ${capture.window_size}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted sm:ml-auto">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1">
                  OS: not recorded
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-subtle px-2.5 py-1">
                  Browser: not recorded
                </span>
              </div>
            </div>

            {/* Main split */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 flex-1">
              <div className="rounded-xl border border-border bg-subtle/30 p-6 flex items-center justify-center min-h-[320px] sticky top-24 self-start">
                <GoogleDriveViewer url={capture.drive_url} type={capture.type} />
              </div>
              
              <div className="flex flex-col gap-5">
                <div className="rounded-xl border border-border overflow-hidden h-[520px]">
                  <DevToolsPanel logs={capture.dev_logs || []} />
                </div>
                
                <div className="rounded-xl border border-border bg-white p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Comments</h3>
                  <div className="text-xs text-muted py-8 text-center bg-subtle rounded-lg border border-dashed border-border mb-4">
                    Comments database not yet linked to UI state.
                  </div>
                  <div className="flex flex-col gap-2">
                    <textarea 
                      placeholder="Write a comment..." 
                      className="w-full text-sm rounded-lg border border-border px-3 py-2 outline-none focus:border-indigo-500 min-h-[80px]"
                    />
                    <div className="flex items-center justify-between">
                      <button className="text-xs font-medium text-muted hover:text-foreground">
                        @ Timestamp
                      </button>
                      <button className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors">
                        Post Comment
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
