"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DevToolsPanel, { DevLog } from "@/components/DevToolsPanel";
import Comments from "@/components/Comments";
import QrCode from "@/components/QrCode";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  description?: string | null;
  dev_logs?: DevLog[] | null;
  os?: string | null;
  browser?: string | null;
}

function driveFileId(driveUrl: string): string | null {
  const m = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function drivePreviewUrl(driveUrl: string): string | null {
  const id = driveFileId(driveUrl);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

export default function CaptureDetailPage() {
  const params = useParams<{ id: string }>();
  const [capture, setCapture] = useState<Capture | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [author, setAuthor] = useState<{ name?: string; email?: string }>({});
  const [qrOpen, setQrOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  
  // AI Bug Report Modal states
  const [aiModal, setAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiCopied, setAiCopied] = useState(false);

  async function handleGenerateAiReport() {
    setAiModal(true);
    if (aiSummary) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/ai-bug-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: capture?.title,
          devLogs: capture?.dev_logs,
          windowSize: capture?.window_size,
        }),
      });
      const json = await res.json();
      if (json.summary) setAiSummary(json.summary);
    } catch {
      setAiSummary("Failed to generate AI report.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleExport(kind: "markdown" | "html" | "json") {
    if (!capture) return;
    const logs = Array.isArray(capture.dev_logs) ? capture.dev_logs : [];
    const consoleErrors = logs.filter((l) => l.type === "console");
    const networkErrors = logs.filter((l) => l.type === "network");
    const actions = logs.filter((l) => l.type === "step");

    const lines = [
      `# ${capture.title}`,
      ``,
      `- **Type:** ${capture.type}`,
      `- **Created:** ${new Date(capture.created_at).toLocaleString()}`,
      `- **Window:** ${capture.window_size || "-"}`,
      `- **Capture:** ${window.location.href}`,
      ``,
      `## Console (${consoleErrors.length})`,
      ...(consoleErrors.length
        ? consoleErrors.map((c) => `- [${c.level || "ERROR"}] ${c.message || c.text || ""}`)
        : ["None"]),
      ``,
      `## Network (${networkErrors.length})`,
      ...(networkErrors.length
        ? networkErrors.map((n) => `- ${n.method || "GET"} ${n.url || ""} (${n.status || "FAILED"})`)
        : ["None"]),
      ``,
      `## Actions (${actions.length})`,
      ...(actions.length
        ? actions.map((a) => `- ${a.time || ""} ${a.message || ""}`)
        : ["None"]),
    ];

    const filename = (capture.title || "capture").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 80);
    let content = lines.join("\n");
    let mime = "text/markdown";
    let ext = "md";
    if (kind === "html") {
      content = `<h1>${capture.title}</h1><pre>${lines.join("\n")}</pre>`;
      mime = "text/html";
      ext = "html";
    } else if (kind === "json") {
      content = JSON.stringify(capture, null, 2);
      mime = "application/json";
      ext = "json";
    }
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      if (!u) return;
      const meta = u.user_metadata || {};
      setAuthor({
        name: meta.full_name || meta.name || u.email?.split("@")[0] || undefined,
        email: u.email || undefined,
      });
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const id = params.id;
    if (!id) { setNotFound(true); setLoading(false); return; }
    // ponytail: explicit column list, never select password to the browser
    supabase
      .from("captures")
      .select("id, title, type, drive_url, created_at, window_size, description, dev_logs, os, browser")
      .eq("id", id)
      .single()
      .then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setNotFound(true); setLoading(false); return; }
      setCapture(data as Capture);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [params.id]);

  function handleCopyLink() {
    if (!capture) return;
    // Share the public mazway page (which enforces password/expiry and
    // counts views), not the raw Google Drive URL.
    const shareUrl = `${window.location.origin}/c/${capture.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return <div className="p-12 text-center text-sm text-muted">Loading capture...</div>;
  if (notFound || !capture) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-muted mb-4">Capture not found or inaccessible.</p>
        <Link href="/captures" className="text-sm text-indigo-600 font-medium hover:underline">← Back</Link>
      </div>
    );
  }

  const previewUrl = drivePreviewUrl(capture.drive_url);
  const thumbUrl = (() => { const id = driveFileId(capture.drive_url); return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : null; })();

  return (
    <div className="h-screen bg-white flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/captures" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted hover:bg-subtle shrink-0 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </Link>
          <Link href="/captures" className="text-sm text-muted hover:text-foreground">All Captures</Link>
          <span className="text-muted/40">/</span>
          <span className="text-sm font-semibold text-foreground truncate max-w-[280px]">{capture.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleGenerateAiReport}
            className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>✨ AI Bug Report</span>
          </button>
          {/* More Actions Dropdown */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 ${
                moreOpen
                  ? "bg-subtle border-indigo-200 text-foreground"
                  : "border-border text-muted hover:text-foreground hover:bg-subtle"
              }`}
            >
              <span>More</span>
              <svg className={`w-3.5 h-3.5 text-muted transition-transform ${moreOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full mt-1.5 w-48 z-50 bg-white border border-border rounded-xl shadow-xl py-1 px-1 flex flex-col gap-0.5">
                  <a
                    href={capture.drive_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreOpen(false)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    <span>Open in Drive</span>
                    <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4" />
                    </svg>
                  </a>
                  
                  <div className="border-t border-border/60 my-1" />
                  
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Share to</p>
                  </div>
                  
                  <a
                    href={`https://slack.com/app_redirect?channel=${encodeURIComponent("#general")}&team=&app=SLACK`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    <span>Slack</span>
                  </a>
                  <a
                    href={`https://discord.com/channels/@me`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMoreOpen(false)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    <span>Discord</span>
                  </a>
                  
                  <div className="border-t border-border/60 my-1" />
                  
                  <div className="px-3 py-1">
                    <p className="text-[9px] font-bold text-muted uppercase tracking-wider">Export Logs</p>
                  </div>
                  
                  <button
                    onClick={() => { handleExport("markdown"); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    Markdown (.md)
                  </button>
                  <button
                    onClick={() => { handleExport("html"); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    HTML report
                  </button>
                  <button
                    onClick={() => { handleExport("json"); setMoreOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    JSON data
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* QR Code Popover for Mobile QA testing */}
          <div className="relative">
            <button
              onClick={() => setQrOpen(!qrOpen)}
              title="Scan QR Code to open on mobile"
              className={`p-1.5 rounded-lg border transition-colors flex items-center justify-center ${
                qrOpen
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                  : "border-border text-muted hover:text-foreground hover:bg-subtle"
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
                <line x1="9" y1="15" x2="9.01" y2="15" />
                <line x1="15" y1="15" x2="15.01" y2="15" />
              </svg>
            </button>
            {qrOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setQrOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 p-4 bg-white border border-border rounded-xl shadow-xl flex flex-col items-center gap-2 w-40">
                  <p className="text-[10px] font-semibold text-muted text-center leading-tight">Mobile QA Scan</p>
                  <QrCode value={`${window.location.origin}/c/${capture.id}`} size={120} />
                </div>
              </>
            )}
          </div>

          <button onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-400 text-white text-xs font-semibold hover:bg-emerald-500 flex items-center gap-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Left */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Canvas */}
          <div className="bg-[#f4f4f6] border border-border/70 rounded-2xl p-6 min-h-[380px] flex items-center justify-center">
            {capture.type === "video" && previewUrl ? (
              <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
                <iframe src={previewUrl} className="w-full h-full" allow="autoplay; fullscreen; encrypted-media" allowFullScreen title={capture.title}/>
              </div>
            ) : capture.type === "screenshot" && thumbUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumbUrl} alt={capture.title} referrerPolicy="no-referrer"
                  onError={() => setThumbFailed(true)}
                  className={`max-w-full max-h-[68vh] object-contain rounded-xl shadow-md border border-border/40 ${thumbFailed ? "hidden" : ""}`}
                />
                {thumbFailed && (
                  <div className="py-16 text-center text-muted">
                    <p className="text-sm">Preview unavailable</p>
                    <a href={capture.drive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-1 block">Open in Drive →</a>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-muted py-16">
                <p className="text-sm">Preview unavailable</p>
                <a href={capture.drive_url} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-600 hover:underline mt-1 block">Open in Drive →</a>
              </div>
            )}
          </div>

          {/* Title + Comments */}
          <div className="border border-border/80 rounded-xl p-4 bg-white space-y-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{capture.title}</h2>
              {capture.description && <p className="text-xs text-muted mt-0.5">{capture.description}</p>}
            </div>
            {/* The Drive preview iframe is cross-origin, so we can't read its
                currentTime. Comments reads the time at submit via getCurrentTime
                when a player exposes it; here it's omitted, so timestamped
                comments use a manual m:ss input (best-effort). */}
            <Comments
              captureId={capture.id}
              isVideo={capture.type === "video"}
              authorName={author.name}
              authorEmail={author.email}
            />
          </div>
        </div>

        {/* Right: DevTools */}
        <DevToolsPanel capture={capture} />
      </div>

      {/* AI Bug Report Modal */}
      {aiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAiModal(false)} />
          <div className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl border border-border max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-foreground">✨ AI Bug Report</h3>
              <button onClick={() => setAiModal(false)} className="text-muted hover:text-foreground" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-xs text-muted mb-4">
              Auto-generated analysis from captured console errors, network activity, and user actions.
            </p>

            {aiLoading ? (
              <div className="py-10 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
                <p className="text-xs text-muted">Analyzing capture data...</p>
              </div>
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap bg-subtle/60 border border-border rounded-lg p-4 text-foreground leading-relaxed max-h-[50vh] overflow-y-auto">
                {aiSummary || "Click Generate to create the report."}
              </pre>
            )}

            <div className="flex items-center justify-between gap-2 mt-4">
              <div className="flex gap-2">
                <a
                  href={`https://github.com/new?title=${encodeURIComponent(capture?.title || "Bug")}&body=${encodeURIComponent(aiSummary)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle transition-colors"
                >
                  GitHub Issue
                </a>
                <a
                  href={`https://linear.app/issue?title=${encodeURIComponent(capture?.title || "Bug")}&description=${encodeURIComponent(aiSummary)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle transition-colors"
                >
                  Linear
                </a>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiSummary);
                  setAiCopied(true);
                  setTimeout(() => setAiCopied(false), 2000);
                }}
                disabled={!aiSummary}
                className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {aiCopied ? "Copied!" : "Copy Report"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
