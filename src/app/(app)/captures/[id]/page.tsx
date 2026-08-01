"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DevToolsPanel, { DevLog } from "@/components/DevToolsPanel";
import Comments from "@/components/Comments";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  description?: string | null;
  dev_logs?: DevLog[] | null;
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
      .select("id, title, type, drive_url, created_at, window_size, description, dev_logs")
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
    <div className="min-h-screen bg-white flex flex-col font-sans">
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
          <a href={capture.drive_url} target="_blank" rel="noopener noreferrer"
            className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle flex items-center gap-1.5 transition-colors">
            Open in Drive
            <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4"/></svg>
          </a>
          <button onClick={handleCopyLink}
            className="px-3.5 py-1.5 rounded-lg bg-emerald-400 text-white text-xs font-semibold hover:bg-emerald-500 flex items-center gap-1.5 transition-colors">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
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
    </div>
  );
}
