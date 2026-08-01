"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DevToolsPanel, { DevLog } from "@/components/DevToolsPanel";

// NOTE: `password` and `expires_at` are intentionally absent from this
// public payload — the server-side RPC `get_public_capture` decides
// access and never returns them.
interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string | null;
  created_at: string;
  window_size?: string | null;
  description?: string | null;
  dev_logs?: DevLog[] | null;
  os?: string | null;
  browser?: string | null;
  location?: string | null;
  status: "ok" | "expired" | "needs_password" | "not_found";
}

function driveFileId(driveUrl: string): string | null {
  const m = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function drivePreviewUrl(driveUrl: string): string | null {
  const id = driveFileId(driveUrl);
  return id ? `https://drive.google.com/file/d/${id}/preview` : null;
}

function driveThumbUrl(driveUrl: string): string | null {
  const id = driveFileId(driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : null;
}

interface CommentItem {
  id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export default function PublicSharePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [capture, setCapture] = useState<Capture | null>(null);
  const [status, setStatus] = useState<"loading" | "locked" | "expired" | "notfound" | "ready">("loading");
  const [thumbFailed, setThumbFailed] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const recordedViewRef = useRef<string | null>(null);

  // Comments
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);

  // Embed Modal
  const [embedModal, setEmbedModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);

  // AI Bug Report Modal
  const [aiModal, setAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiCopied, setAiCopied] = useState(false);

  // Custom Branding
  const [brand, setBrand] = useState({ name: "mazway", logo: "", hideWatermark: false });

  useEffect(() => {
    // Check local storage for mocked branding settings
    try {
      const savedData = localStorage.getItem("mazway_settings");
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setBrand({
          name: parsed.brandName || "mazway",
          logo: parsed.logoUrl || "",
          hideWatermark: !!parsed.hideWatermark,
        });
      }
    } catch {}

    let cancelled = false;
    if (!id) { setStatus("notfound"); return; }

    // Record a view when the capture is opened (only once per session/visit).
    // viewer_ref = short hash so repeated reloads from the same session don't
    // inflate counts, while still letting each unique visit count.
    try {
      const ref = localStorage.getItem("mazway_visitor") || Math.random().toString(36).slice(2, 10);
      localStorage.setItem("mazway_visitor", ref);
      supabase.rpc("record_view", { p_capture_id: id, p_ref: ref });
    } catch {}

    // First call: no password. The RPC leaks nothing — password and
    // expires_at never cross the network, and drive_url/dev_logs are
    // nulled out for locked/expired rows.
    supabase
      .rpc("get_public_capture", { p_id: id, p_password: null })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) { setStatus("notfound"); return; }

        const row = data[0] as Capture;
        switch (row.status) {
          case "not_found":
            setStatus("notfound");
            break;
          case "expired":
            setStatus("expired");
            break;
          case "needs_password":
            setCapture(row);
            setStatus("locked");
            break;
          default:
            setCapture(row);
            setStatus("ready");
        }
      });

    // Fetch public comments
    supabase
      .from("comments")
      .select("*")
      .eq("capture_id", id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) setComments(data as CommentItem[]);
      });

    // Fetch view count
    supabase.rpc("get_view_count", { p_capture_id: id }).then(({ data }) => {
      if (!cancelled && data != null) setViewCount(Number(data));
    });

    return () => { cancelled = true; };
  }, [id]);

  // View tracking: fire once per capture id once the share page renders
  // (public viewers are anonymous; the RPC is SECURITY DEFINER). Runs on
  // password-unlock too since the capture becomes visible then. Never
  // blocks rendering.
  useEffect(() => {
    if (!id || !capture || capture.status !== "ok") return;
    if (recordedViewRef.current === id) return;
    recordedViewRef.current = id;

    let cancelled = false;
    (async () => {
      try {
        const { error } = await supabase.rpc("record_view", { p_capture_id: id, p_ref: document.referrer || null });
        if (error && !cancelled) recordedViewRef.current = null;
      } catch {
        if (!cancelled) recordedViewRef.current = null;
      }
    })();
    (async () => {
      try {
        const { data } = await supabase.rpc("get_view_count", { p_capture_id: id });
        if (!cancelled && typeof data === "number") setViewCount(data);
      } catch {}
    })();

    return () => { cancelled = true; };
  }, [id, capture]);

  async function handleAddComment() {
    if (!newComment.trim() || !capture) return;
    setPosting(true);
    const payload = {
      capture_id: capture.id,
      user_name: "Visitor",
      content: newComment.trim(),
    };
    const { data, error } = await supabase.from("comments").insert([payload]).select().single();
    if (!error && data) {
      setComments((prev) => [...prev, data as CommentItem]);
      setNewComment("");
    }
    setPosting(false);
  }

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

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordInput) return;
    setCheckingPassword(true);
    setPasswordError(false);
    supabase
      .rpc("get_public_capture", { p_id: id, p_password: passwordInput })
      .then(({ data, error }) => {
        setCheckingPassword(false);
        if (error || !data || data.length === 0) { setStatus("notfound"); return; }

        const row = data[0] as Capture;
        if (row.status === "ok") {
          setCapture(row);
          setStatus("ready");
        } else if (row.status === "not_found") {
          setStatus("notfound");
        } else if (row.status === "expired") {
          setStatus("expired");
        } else {
          // needs_password again → wrong password (or still locked)
          setCapture(row);
          setPasswordError(true);
        }
      });
  }

  const previewUrl = capture?.drive_url ? drivePreviewUrl(capture.drive_url) : null;
  const thumbUrl = capture?.drive_url ? driveThumbUrl(capture.drive_url) : null;

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.href : ""}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <header className="h-14 border-b border-border px-6 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          {brand.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={brand.logo} alt="" className="h-6 w-auto object-contain" />
          ) : (
            <span className="text-base font-bold tracking-tight text-foreground">{brand.name}</span>
          )}
          {!brand.hideWatermark && (
            <span className="text-[10px] font-semibold text-muted bg-subtle px-1.5 py-0.5 rounded">Screen Recorder</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {status === "ready" && (
            <>
              <button
                onClick={handleGenerateAiReport}
                className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <span>✨ AI Bug Report</span>
              </button>
              <button onClick={() => setEmbedModal(true)} className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle transition-colors">
                Embed
              </button>
            </>
          )}
          <a href="/" className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle transition-colors">Login</a>
          <a href="/" className="px-3.5 py-1.5 rounded-lg bg-emerald-400 text-white text-xs font-semibold hover:bg-emerald-500 transition-colors">Get Mazway</a>
        </div>
      </header>

      {status !== "ready" && (
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {status === "loading" && (
          <p className="text-sm text-muted">Loading capture...</p>
        )}

        {status === "notfound" && (
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">Capture not found</h1>
            <p className="text-sm text-muted mt-1 mb-4">
              The link you opened doesn&apos;t match any capture in this workspace.
            </p>
            <a href="/" className="text-sm text-indigo-600 font-medium hover:underline">← Login to Mazway</a>
          </div>
        )}

        {status === "expired" && (
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">This link has expired</h1>
            <p className="text-sm text-muted mt-1 mb-4">
              This capture link is no longer available. Ask the owner to share an updated link.
            </p>
            <a href="/" className="text-sm text-indigo-600 font-medium hover:underline">← Login to Mazway</a>
          </div>
        )}

        {status === "locked" && (
          <div className="w-full max-w-sm text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
            </div>
            <h1 className="text-lg font-semibold text-foreground">
              {capture?.title ? `"${capture.title}" is password protected` : "This capture is password protected"}
            </h1>
            <p className="text-sm text-muted mt-1 mb-6">
              Enter the password to view this capture.
            </p>
            <form onSubmit={submitPassword} className="flex flex-col gap-3">
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                placeholder="Password"
                autoFocus
                className={`w-full text-sm rounded-lg border px-3 py-2.5 outline-none bg-white ${
                  passwordError ? "border-red-400" : "border-border focus:border-indigo-500"
                }`}
              />
              {passwordError && (
                <p className="text-xs text-red-600 text-left">Incorrect password. Try again.</p>
              )}
              <button
                type="submit"
                disabled={checkingPassword}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {checkingPassword ? "Unlocking..." : "Unlock Capture"}
              </button>
            </form>
          </div>
        )}
      </div>
      )}

      {status === "ready" && capture && (
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div className="bg-[#f4f4f6] border border-border/70 rounded-2xl p-6 min-h-[380px] flex items-center justify-center">
              {capture.type === "video" && previewUrl ? (
                <div className="w-full aspect-video rounded-xl overflow-hidden shadow-lg bg-black">
                  <iframe src={previewUrl} className="w-full h-full" allow="autoplay; fullscreen; encrypted-media" allowFullScreen title={capture.title}/>
                </div>
              ) : capture.type === "screenshot" && thumbUrl && !thumbFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={thumbUrl} alt={capture.title} referrerPolicy="no-referrer"
                  onError={() => setThumbFailed(true)}
                  className="max-w-full max-h-[68vh] object-contain rounded-xl shadow-md border border-border/40"
                />
              ) : (
                <div className="text-center text-muted py-16">
                  <p className="text-sm">Preview unavailable</p>
                </div>
              )}
            </div>

            {/* Title + Comments */}
            <div className="border border-border/80 rounded-xl p-4 bg-white space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-foreground">{capture.title}</h2>
                  {capture.description && <p className="text-xs text-muted mt-0.5">{capture.description}</p>}
                </div>
                {viewCount !== null && (
                  <span className="shrink-0 text-xs text-muted whitespace-nowrap mt-0.5">👁 {viewCount} views</span>
                )}
              </div>

              {/* Comment List */}
              {comments.length > 0 && (
                <div className="space-y-3 pt-3 border-t border-border/60">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Comments ({comments.length})</p>
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3 text-xs bg-subtle/50 p-3 rounded-lg border border-border/50">
                      <div className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                        {c.user_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-semibold text-foreground">{c.user_name}</span>
                          <span className="text-[10px] text-muted">{new Date(c.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <p className="text-foreground leading-relaxed break-words">{c.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Comment Input */}
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Write a comment..."
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  className="flex-1 text-xs rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-subtle/50"
                />
                <button
                  onClick={handleAddComment}
                  disabled={posting || !newComment.trim()}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {posting ? "Posting..." : "Comment"}
                </button>
              </div>
            </div>
          </div>

          <DevToolsPanel capture={capture as unknown as React.ComponentProps<typeof DevToolsPanel>["capture"]} />
        </div>
      )}

      {/* Embed Modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEmbedModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-border">
            <h3 className="text-base font-bold text-foreground mb-1">Embed Capture</h3>
            <p className="text-xs text-muted mb-4">Paste this code into Notion, WordPress, or your custom app.</p>
            <textarea
              readOnly
              value={embedCode}
              className="w-full h-24 text-xs font-mono p-3 bg-subtle border border-border rounded-lg outline-none resize-none"
            />
            <div className="flex items-center justify-between mt-4 gap-4">
              {/* QR Code (no dependency — rendered via qrserver API) */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=96x96&data=${encodeURIComponent(window.location.href)}`}
                  alt="QR code"
                  className="w-24 h-24 rounded-lg border border-border"
                />
                <span className="text-[10px] text-muted">Scan to open</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEmbedModal(false)} className="px-4 py-2 text-xs font-medium text-muted hover:text-foreground">Close</button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(embedCode);
                    setEmbedCopied(true);
                    setTimeout(() => setEmbedCopied(false), 2000);
                  }}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  {embedCopied ? "Copied!" : "Copy Code"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
