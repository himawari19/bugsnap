"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import DevToolsPanel, { DevLog } from "@/components/DevToolsPanel";
import QrCode from "@/components/QrCode";
import Comments from "@/components/Comments";

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
  site_url?: string | null;
  allowed_domains?: string[] | null;
  allowed_ips?: string[] | null;
  workspace_id?: string | null;
  expires_at?: string | null;
  status: "ok" | "expired" | "needs_password" | "not_found" | "unauthorized_ip" | "needs_login" | "unauthorized_domain";
}

interface WorkspaceMember {
  user_id: string;
}

function getExpiryCountdown(expiresAt: string): string {
  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "Expired";
  const hours = Math.floor(diffMs / (60 * 60 * 1000));
  if (hours < 24) {
    if (hours < 1) {
      const mins = Math.max(1, Math.floor(diffMs / 60000));
      return `Expires in ${mins} minute${mins === 1 ? "" : "s"}`;
    }
    if (hours < 2) return "Expires in under 1 hour";
    return `Expires in ${hours} hours`;
  }
  const days = Math.ceil(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function driveFileId(driveUrl: string): string | null {
  const m = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function driveThumbUrl(driveUrl: string): string | null {
  const id = driveFileId(driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1200` : null;
}

export default function PublicSharePage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [capture, setCapture] = useState<Capture | null>(null);
  const [status, setStatus] = useState<"loading" | "locked" | "expired" | "notfound" | "unauthorized_ip" | "needs_login" | "unauthorized_domain" | "ready">("loading");
  const [thumbFailed, setThumbFailed] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const recordedViewRef = useRef<string | null>(null);

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
  const [qrOpen, setQrOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [viewerEmail, setViewerEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.email) {
        setViewerEmail(data.session.user.email);
      }
    });
  }, []);

  // Bypass password gate for workspace members/owners: if the logged-in
  // user is a member of this capture's workspace, force status to "ready".
  useEffect(() => {
    if (!id || status !== "locked") return;
    let cancelled = false;
    (async () => {
      // Resolve workspace_id for this capture. Direct select is RLS-gated
      // to workspace members, so a non-member sees no row and never unlocks.
      const { data: me } = await supabase.auth.getSession();
      if (cancelled || !me.session?.user) return;
      const { data: capRows } = await supabase
        .from("captures")
        .select("workspace_id")
        .eq("id", id)
        .limit(1);
      const wsId = capRows?.[0]?.workspace_id;
      if (!wsId) return;
      const { data: members } = await supabase.rpc("get_workspace_members", {
        p_workspace_id: wsId,
      });
      if (cancelled) return;
      const isMember = (members as WorkspaceMember[] | null)?.some(
        (m) => m.user_id === me.session!.user.id
      );
      if (isMember) setStatus("ready");
    })();
    return () => {
      cancelled = true;
    };
  }, [id, status]);

  // Dynamic Open Graph / social meta tags for Slack/Discord previews.
  useEffect(() => {
    if (!capture) return;
    const shareUrl = `${window.location.origin}/c/${id}`;
    const metas: Record<string, string> = {
      "og:title": `${capture.title} — Mazway`,
      "og:description": capture.description || "Screen capture shared via Mazway",
      "og:url": shareUrl,
      "og:type": "website",
      "og:site_name": "Mazway",
      "og:image": capture.drive_url ? driveThumbUrl(capture.drive_url)! : "",
      "twitter:card": "summary_large_image",
      "twitter:title": `${capture.title} · Mazway`,
      "twitter:description": capture.description || "Screen capture shared via Mazway",
      "twitter:image": capture.drive_url ? driveThumbUrl(capture.drive_url)! : "",
    };
    Object.entries(metas).forEach(([prop, content]) => {
      if (!content) return;
      let el = document.head.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement("meta");
        document.head.appendChild(el);
      }
      el.setAttribute("property", prop);
      el.setAttribute("name", prop);
      el.setAttribute("content", content);
    });
  }, [capture, id, thumbFailed]);

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

    // Client-side UUID validation to prevent database casting errors (HTTP 400)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      setStatus("notfound");
      return;
    }

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
          case "unauthorized_ip":
            setCapture(row);
            setStatus("unauthorized_ip");
            break;
          case "needs_login":
            setCapture(row);
            setStatus("needs_login");
            break;
          case "unauthorized_domain":
            setCapture(row);
            setStatus("unauthorized_domain");
            break;
          default:
            setCapture(row);
            setStatus("ready");
        }
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
        } else if (row.status === "unauthorized_ip") {
          setStatus("unauthorized_ip");
        } else if (row.status === "needs_login") {
          setStatus("needs_login");
        } else if (row.status === "unauthorized_domain") {
          setStatus("unauthorized_domain");
        } else {
          // needs_password again → wrong password (or still locked)
          setCapture(row);
          setPasswordError(true);
        }
      });
  }

  const thumbUrl = capture?.drive_url ? driveThumbUrl(capture.drive_url) : null;

  const embedCode = `<iframe src="${typeof window !== "undefined" ? window.location.href : ""}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="h-screen bg-white flex flex-col font-sans overflow-hidden">
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
            <button
              onClick={handleGenerateAiReport}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>✨ AI Bug Report</span>
            </button>
          )}

          {/* QR Code Popover for Mobile QA testing */}
          {status === "ready" && (
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
                    <QrCode value={typeof window !== "undefined" ? window.location.href : ""} size={120} />
                  </div>
                </>
              )}
            </div>
          )}

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
                <div className="absolute right-0 top-full mt-1.5 w-36 z-50 bg-white border border-border rounded-xl shadow-xl py-1 px-1 flex flex-col gap-0.5">
                  {status === "ready" && (
                    <button
                      onClick={() => { setEmbedModal(true); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                    >
                      Embed
                    </button>
                  )}
                  <a
                    href="/"
                    onClick={() => setMoreOpen(false)}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                  >
                    Login
                  </a>
                </div>
              </>
            )}
          </div>

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

        {status === "unauthorized_ip" && (
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">Access Restricted</h1>
            <p className="text-sm text-muted mt-1 mb-4">
              Your IP address is not authorized to view this capture.
            </p>
            <a href="/" className="text-sm text-indigo-600 font-medium hover:underline">← Login to Mazway</a>
          </div>
        )}

        {status === "needs_login" && (
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">Login Required</h1>
            <p className="text-sm text-muted mt-1 mb-6">
              This capture is restricted to specific email domains. Please sign in to verify your identity.
            </p>
            <a
              href="/"
              className="px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm transition-colors"
            >
              Sign In to Mazway
            </a>
          </div>
        )}

        {status === "unauthorized_domain" && (
          <div className="text-center max-w-sm">
            <svg className="w-12 h-12 mx-auto text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
            <p className="text-sm text-muted mt-1 mb-4">
              Your email domain is not authorized to view this capture.
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
          <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
            <div className="bg-[#f4f4f6] border border-border/70 rounded-2xl p-6 min-h-[380px] flex items-center justify-center relative overflow-hidden">
              {/* Security Watermark Overlay */}
              {((capture.allowed_domains && capture.allowed_domains.length > 0) || 
                (capture.allowed_ips && capture.allowed_ips.length > 0)) && (
                <div className="absolute inset-0 z-10 pointer-events-none opacity-[0.03] select-none flex flex-wrap items-center justify-center gap-16 p-4">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <span
                      key={i}
                      className="text-xs font-bold font-mono tracking-widest uppercase rotate-[-25deg] whitespace-nowrap"
                    >
                      CONFIDENTIAL · VIEWER: {viewerEmail || "VISITOR"}
                    </span>
                  ))}
                </div>
              )}

              {capture.type === "video" ? (
                <div className="w-full h-full rounded-xl overflow-hidden shadow-lg bg-black flex items-center justify-center">
                  <video
                    controls
                    className="w-full h-full object-contain outline-none"
                    preload="metadata"
                  >
                    <source
                      src={`https://drive.google.com/uc?id=${driveFileId(capture.drive_url || "")}&export=download`}
                      type="video/webm"
                    />
                    <source
                      src={`https://drive.google.com/uc?id=${driveFileId(capture.drive_url || "")}&export=download`}
                      type="video/mp4"
                    />
                    Your browser does not support the video tag.
                  </video>
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
                  {capture.expires_at && (
                    <p className="text-[11px] text-muted mt-1 font-medium">
                      {getExpiryCountdown(capture.expires_at)}
                    </p>
                  )}
                </div>
                {viewCount !== null && (
                  <span className="shrink-0 text-xs text-muted whitespace-nowrap mt-0.5">👁 {viewCount} views</span>
                )}
              </div>

              {/* Realtime Comments Component */}
              <div className="pt-2 border-t border-border/40">
                <Comments
                  captureId={capture.id}
                  isVideo={capture.type === "video"}
                  authorName="Visitor"
                />
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
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-foreground">Embed Capture</h3>
              <button onClick={() => setEmbedModal(false)} className="text-muted hover:text-foreground" aria-label="Close">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <p className="text-xs text-muted mb-4">Paste this code into Notion, WordPress, or your custom app.</p>

            {/* QR code centered — generated locally (no external service) */}
            <div className="flex flex-col items-center gap-1.5 mb-5">
              <QrCode value={typeof window !== "undefined" ? window.location.href : ""} size={128} />
              <span className="text-[11px] text-muted">Scan to open this capture on your phone</span>
            </div>

            <label className="block text-[10px] font-semibold uppercase tracking-widest text-muted mb-1.5">Embed Code</label>
            <textarea
              readOnly
              value={embedCode}
              className="w-full h-24 text-xs font-mono p-3 bg-subtle border border-border rounded-lg outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-4">
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
