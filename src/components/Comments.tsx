"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export interface CommentRow {
  id: string;
  capture_id: string;
  author_name: string | null;
  author_email: string | null;
  body: string;
  video_timestamp: number | null; // seconds into the video; null for screenshots / non-timestamped
  created_at: string;
  parent_id?: string | null; // thread reply support
  tag?: string | null; // e.g. bug / feature-request / wip
  status?: string | null; // e.g. open / in-progress / fixed
}

interface CommentsProps {
  captureId: string;
  isVideo: boolean;
  authorName?: string;
  authorEmail?: string;
  /**
   * Returns the video player's current playback position in seconds.
   * Called at submit time. Omit when the player can't be read — the Drive
   * preview iframe is cross-origin and exposes no currentTime — in which
   * case the composer falls back to a manual m:ss input (best-effort).
   */
  getCurrentTime?: () => number;
  /**
   * Called with a comment's timestamp when its `@ m:ss` badge is clicked,
   * so the host can seek the player. Omit when the player can't be
   * controlled (Drive iframe); the badge then renders non-interactive.
   */
  onSeek?: (seconds: number) => void;
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
];

function avatarColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

/** Accepts "83" or "1:23"; returns seconds, or null when malformed. */
function parseTimestamp(input: string): number | null {
  const m = input.trim().match(/^(?:(\d+):)?([0-5]?\d)$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  return minutes * 60 + parseInt(m[2], 10);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function Comments({
  captureId,
  isVideo,
  authorName,
  authorEmail,
  getCurrentTime,
  onSeek,
}: CommentsProps) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [timestampOn, setTimestampOn] = useState(false);
  const [manualTime, setManualTime] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    supabase
      .from("comments")
      .select("*")
      .eq("capture_id", captureId)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          setError("Couldn't load comments.");
          return;
        }
        setComments((data as CommentRow[]) ?? []);
      });

    // Live updates: new comments only. Requires Realtime on the comments
    // table (see header of supabase/002_comments.sql).
    const channel = supabase
      .channel(`comments-${captureId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "comments",
          filter: `capture_id=eq.${captureId}`,
        },
        (payload) => {
          const row = payload.new as CommentRow;
          if (!row?.id) return;
          setComments((prev) =>
            prev.some((c) => c.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [captureId]);

  async function handleSubmit() {
    const text = body.trim();
    if (!text || submitting) return;

    let video_timestamp: number | null = null;
    if (isVideo && timestampOn) {
      const t = getCurrentTime?.();
      if (typeof t === "number" && isFinite(t) && t >= 0) {
        video_timestamp = Math.floor(t);
      } else {
        // Fallback when the player can't be read (Drive iframe): manual m:ss.
        video_timestamp = parseTimestamp(manualTime);
        if (video_timestamp === null) {
          setError("Enter a video time like 1:23 (m:ss), or turn the timestamp off.");
          return;
        }
      }
    }

    const author_name = authorName || null;
    const author_email = authorEmail || null;
    const optimisticId = `local-${Date.now()}`;
    setComments((prev) => [
      ...prev,
      {
        id: optimisticId,
        capture_id: captureId,
        author_name,
        author_email,
        body: text,
        video_timestamp,
        created_at: new Date().toISOString(),
      },
    ]);
    setBody("");
    setManualTime("");
    setTimestampOn(false);
    setError("");
    setSubmitting(true);

    try {
      // Use the rate-limited RPC so anonymous users can't spam comments.
      const visitorRef = (() => {
        try {
          let ref = localStorage.getItem("mazway_visitor");
          if (!ref) {
            ref = Math.random().toString(36).slice(2, 10);
            localStorage.setItem("mazway_visitor", ref);
          }
          return ref;
        } catch {
          return "";
        }
      })();
      const { data, error } = await supabase.rpc("post_comment", {
        p_capture_id: captureId,
        p_visitor_ref: visitorRef,
        p_body: text,
        p_author_name: author_name,
        p_author_email: author_email,
      });
      if (error) throw error;
      setComments((prev) =>
        prev.map((c) => (c.id === optimisticId ? (data as CommentRow) : c))
      );
    } catch (err) {
      setComments((prev) => prev.filter((c) => c.id !== optimisticId));
      setError(
        (err as { message?: string })?.message ||
          "Couldn't post the comment. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReply(parentId: string) {
    const text = replyBody.trim();
    if (!text || replying) return;
    const author_name = authorName || null;
    const author_email = authorEmail || null;
    setReplying(true);
    try {
      // Replies also go through the rate-limited RPC.
      const visitorRef = (() => {
        try {
          let ref = localStorage.getItem("mazway_visitor");
          if (!ref) {
            ref = Math.random().toString(36).slice(2, 10);
            localStorage.setItem("mazway_visitor", ref);
          }
          return ref;
        } catch {
          return "";
        }
      })();
      const { data, error } = await supabase.rpc("post_comment", {
        p_capture_id: captureId,
        p_visitor_ref: visitorRef,
        p_body: text,
        p_author_name: author_name,
        p_author_email: author_email,
        p_parent_id: parentId,
      });
      if (error) throw error;
      setComments((prev) => [...prev, data as CommentRow]);
      setReplyBody("");
      setReplyingTo(null);
    } catch {
      setError("Couldn't post the reply. Please try again.");
    } finally {
      setReplying(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Composer (always visible) */}
      <div className="space-y-2 shrink-0">
        {isVideo && (
          <div className="flex items-center gap-2">
            <input
              id="comment-timestamp-toggle"
              type="checkbox"
              checked={timestampOn}
              onChange={(e) => setTimestampOn(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-border accent-indigo-600 cursor-pointer"
            />
            <label
              htmlFor="comment-timestamp-toggle"
              className="text-xs text-muted cursor-pointer select-none"
            >
              {getCurrentTime
                ? "Comment at current video time"
                : "Comment at video time"}
            </label>
            {timestampOn && !getCurrentTime && (
              <input
                value={manualTime}
                onChange={(e) => setManualTime(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="1:23"
                aria-label="Video time (m:ss)"
                className="w-16 rounded-lg border border-border bg-subtle/50 px-2 py-1 text-xs font-mono text-foreground outline-none focus:border-indigo-500"
              />
            )}
          </div>
        )}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Write a comment…"
          rows={2}
          className="w-full text-xs rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-subtle/50 resize-none placeholder:text-muted/70"
        />
        <div className="flex items-center justify-between gap-2">
          {error && (
            <span className="text-[11px] text-red-600">{error}</span>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !body.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors ml-auto"
          >
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </div>

      {/* List — scrolls internally so long threads never push the page
          beyond the DevTools panel height */}
      <div className="max-h-[320px] overflow-y-auto pr-1 -mr-1">
        {loading ? (
          <p className="text-xs text-muted py-2">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-xs text-muted py-2">No comments yet.</p>
        ) : (
        <ul className="space-y-3">
          {comments
            .filter((c) => !c.parent_id) // top-level threads only
            .map((c) => {
              const name = c.author_name || "Guest";
              const seed = c.author_email || c.author_name || c.id;
              const ts = c.video_timestamp;
              const replies = comments.filter((r) => r.parent_id === c.id);
              return (
                <li key={c.id} className="space-y-2">
                  <div className="flex gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${avatarColor(seed)}`}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-foreground">{name}</span>
                        <span className="text-[10px] text-muted">{formatDate(c.created_at)}</span>
                        {ts != null &&
                          (onSeek ? (
                            <button
                              type="button"
                              onClick={() => onSeek(ts)}
                              title={`Jump to ${formatTimestamp(ts)}`}
                              className="text-[10px] font-mono font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5 hover:bg-indigo-100 transition-colors"
                            >
                              @ {formatTimestamp(ts)}
                            </button>
                          ) : (
                            <span className="text-[10px] font-mono font-medium text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-md px-1.5 py-0.5">
                              @ {formatTimestamp(ts)}
                            </span>
                          ))}
                        <button
                          type="button"
                          onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}
                          className="text-[10px] font-medium text-muted hover:text-indigo-600 transition-colors"
                        >
                          Reply
                        </button>
                      </div>
                      <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words">
                        {c.body}
                      </p>

                      {replyingTo === c.id && (
                        <div className="flex items-center gap-2 mt-2">
                          <input
                            value={replyBody}
                            onChange={(e) => setReplyBody(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleReply(c.id);
                              }
                            }}
                            placeholder={`Reply to ${name}…`}
                            className="flex-1 text-xs rounded-lg border border-border px-3 py-2 outline-none focus:border-indigo-500 bg-subtle/50"
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleReply(c.id)}
                            disabled={replying || !replyBody.trim()}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-[11px] font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors shrink-0"
                          >
                            {replying ? "Posting…" : "Reply"}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nested replies */}
                  {replies.length > 0 && (
                    <div className="ml-10 space-y-2 border-l-2 border-border/60 pl-3">
                      {replies.map((r) => {
                        const rName = r.author_name || "Guest";
                        const rSeed = r.author_email || r.author_name || r.id;
                        return (
                          <div key={r.id} className="flex gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0 ${avatarColor(rSeed)}`}
                            >
                              {rName.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-foreground">{rName}</span>
                                <span className="text-[10px] text-muted">{formatDate(r.created_at)}</span>
                              </div>
                              <p className="text-xs text-foreground mt-0.5 whitespace-pre-wrap break-words">
                                {r.body}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
        </ul>
        )}
      </div>
    </div>
  );
}
