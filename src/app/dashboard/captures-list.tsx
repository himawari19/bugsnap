"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type CaptureFilter = "all" | "video" | "screenshot";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  description?: string | null;
  password?: string | null;
  expires_at?: string | null;
}

interface EditModalProps {
  capture: Capture;
  onClose: () => void;
  onSaved: (updated: Capture) => void;
}

const EXPIRY_OPTIONS: { value: "never" | "24h" | "7d"; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

function expiryToOption(expiresAt: string | null | undefined, createdAt: string): string {
  if (!expiresAt) return "never";
  const diffMs = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (diffMs <= 36 * 60 * 60 * 1000) return "24h";
  if (diffMs <= 10.5 * 24 * 60 * 60 * 1000) return "7d";
  return "never";
}

function EditModal({ capture, onClose, onSaved }: EditModalProps) {
  const [title, setTitle] = useState(capture.title);
  const [description, setDescription] = useState(capture.description || "");
  const [password, setPassword] = useState(capture.password || "");
  const [expiry, setExpiry] = useState<string>(() =>
    expiryToOption(capture.expires_at, capture.created_at)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    let expiresAt: string | null = null;
    if (expiry === "24h") expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("captures")
      .update({
        title: title.trim() || capture.title,
        description: description.trim() || null,
        password: password.trim() || null,
        expires_at: expiresAt,
      })
      .eq("id", capture.id)
      .select()
      .single();

    if (error) {
      console.warn("Error updating capture:", error);
      setError("Could not save changes. Please try again.");
      setSaving(false);
      return;
    }
    onSaved(data as Capture);
    onClose();
  }

  const inputClasses =
    "w-full text-sm rounded-lg border border-border px-3 py-2 outline-none focus:border-indigo-500 bg-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-border p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Edit Capture</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Title</label>
            <input className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Description</label>
            <textarea
              className={`${inputClasses} min-h-[72px] resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context for your team..."
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">Link Settings</h3>
            <p className="text-xs text-muted mb-4">Control who can view this capture link.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Password Protection</label>
                <input
                  className={inputClasses}
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave blank for no password"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Expires in</label>
                <div className="inline-flex rounded-lg border border-border bg-subtle p-1 w-full">
                  {EXPIRY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setExpiry(opt.value)}
                      className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        expiry === opt.value
                          ? "bg-white text-foreground shadow-sm"
                          : "text-muted hover:text-foreground"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted mt-1.5">
                  {expiry === "never"
                    ? "Link never expires."
                    : `Link will expire on ${new Date(
                        Date.now() + (expiry === "24h" ? 24 : 168) * 60 * 60 * 1000
                      ).toLocaleDateString()}.`}
                </p>
              </div>
            </div>
          </div>
        </div>

        {error && <p className="mt-4 text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CapturesList({ filter = "all" }: { filter?: CaptureFilter }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Capture | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchCaptures() {
      const { data, error } = await supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Error fetching captures:", error);
      } else if (!cancelled) {
        setCaptures(data || []);
      }
      if (!cancelled) setLoading(false);
    }
    fetchCaptures();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete(id: string) {
    setDeleting(id);
    setDeleteError(null);
    const { error } = await supabase.from("captures").delete().eq("id", id);
    if (error) {
      console.warn("Error deleting capture:", error);
      setDeleteError("Could not delete this capture. Please try again.");
      setDeleting(null);
      return;
    }
    setCaptures((prev) => prev.filter((c) => c.id !== id));
    setDeleting(null);
  }

  const filteredCaptures = captures.filter((item) => {
    if (filter === "video") return item.type === "video";
    if (filter === "screenshot") return item.type === "screenshot";
    return true;
  });

  const videoCount = captures.filter((c) => c.type === "video").length;
  const screenshotCount = captures.filter((c) => c.type === "screenshot").length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {filter === "video"
              ? "Screen Recordings"
              : filter === "screenshot"
              ? "Screenshots"
              : "Recordings & Captures"}
          </h1>
          <p className="text-sm text-muted mt-1">
            Browse and manage your screen recordings and annotated screenshots.
          </p>
        </div>

        {/* Filters */}
        <div className="inline-flex rounded-lg border border-border bg-subtle p-1 self-start sm:self-auto">
          <a
            href="/dashboard"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "all" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            All ({captures.length})
          </a>
          <a
            href="/dashboard/recordings"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "video" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Videos ({videoCount})
          </a>
          <a
            href="/dashboard/screenshots"
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              filter === "screenshot" ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"
            }`}
          >
            Screenshots ({screenshotCount})
          </a>
        </div>
      </div>

      {deleteError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {deleteError}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-muted">Loading your captures...</div>
      ) : filteredCaptures.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-subtle/50">
          <svg className="w-12 h-12 mx-auto text-muted/40 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-base font-semibold text-foreground">No captures found</h3>
          <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
            Use the mazwayScreen browser extension to record or snap your screen. When you click &quot;Create Link&quot;, it will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCaptures.map((item) => (
            <div
              key={item.id}
              className="relative rounded-xl border border-border bg-white hover:shadow-sm transition-shadow flex flex-col"
            >
              <a
                href={item.drive_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col flex-1 group"
              >
                {/* Thumbnail placeholder / Type icon */}
                <div className="aspect-video rounded-t-xl overflow-hidden bg-subtle flex items-center justify-center text-muted text-sm relative group-hover:bg-subtle/80 transition-colors">
                  <div className="flex flex-col items-center gap-1.5">
                    {item.type === "video" ? (
                      <svg className="w-9 h-9 text-indigo-600/80 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 text-indigo-600/80 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                    <span className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5 rounded bg-white/80 border border-border/50 text-foreground">
                      {item.type}
                    </span>
                  </div>
                  {item.expires_at && new Date(item.expires_at).getTime() < Date.now() && (
                    <span className="absolute top-2 left-2 text-[11px] font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
                      Expired
                    </span>
                  )}
                  {item.password && (
                    <span className="absolute top-2 right-2 text-[11px] font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                      Locked
                    </span>
                  )}
                </div>

                {/* Meta */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <h3 className="text-sm font-medium text-foreground line-clamp-1 group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-1">{item.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted mt-3">
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                    <span>{item.window_size || "Screen"}</span>
                  </div>
                </div>
              </a>

              {/* 3-dot menu */}
              <div className="absolute top-2.5 right-2.5">
                <button
                  aria-label="Capture actions"
                  onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                  className="w-7 h-7 rounded-md bg-white/90 border border-border text-muted hover:text-foreground hover:bg-white flex items-center justify-center shadow-sm transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>
              </div>

              {openMenuId === item.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                  <div className="absolute right-2.5 top-10 z-50 w-36 rounded-lg border border-border bg-white shadow-lg py-1">
                    <button
                      onClick={() => {
                        setEditing(item);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-subtle transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        handleDelete(item.id);
                        setOpenMenuId(null);
                      }}
                      disabled={deleting === item.id}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      {deleting === item.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && <EditModal capture={editing} onClose={() => setEditing(null)} onSaved={(updated) => setCaptures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))} />}
    </div>
  );
}
