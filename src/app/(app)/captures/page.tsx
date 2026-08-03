"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type CaptureFilter = "all" | "video" | "screenshot";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  workspace_id?: string | null;
  description?: string | null;
  password?: string | null;
  expires_at?: string | null;
  duration?: number | null;
  tag?: string | null;
  status?: string | null;
  dev_logs?: { type?: string; level?: string; message?: string; text?: string; url?: string; method?: string }[] | null;
  burn_after_read?: boolean;
  allowed_domains?: string[] | null;
  allowed_ips?: string[] | null;
  owner_email?: string | null;
  folder_name?: string | null;
}

const TAG_OPTIONS = ["bug", "feature-request", "wip", "design", "other"];
const STATUS_OPTIONS = ["open", "in-progress", "fixed", "closed"];

interface EditModalProps {
  capture: Capture;
  onClose: () => void;
  onSaved: (updated: Capture) => void;
  userPlan: "free" | "pro";
}

const EXPIRY_OPTIONS: { value: "never" | "24h" | "7d"; label: string }[] = [
  { value: "never", label: "Never" },
  { value: "24h", label: "24 Hours" },
  { value: "7d", label: "7 Days" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  // Older than a week → compact date, same as before.
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDuration(sec: number | null | undefined): string {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function getAvatarColor(seed: string | null | undefined): string {
  const colors = [
    "bg-indigo-600",
    "bg-emerald-600",
    "bg-rose-600",
    "bg-amber-600",
    "bg-violet-600",
    "bg-teal-600",
    "bg-fuchsia-600",
  ];
  let h = 0;
  const s = seed || "";
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function getOwnerInitial(email: string | null | undefined): string {
  if (!email) return "M";
  // Filter out punctuation commonly at the start of title, get clean first letter
  const clean = email.replace(/[^a-zA-Z0-9]/g, "").trim();
  const char = clean.charAt(0);
  return (char || "M").toUpperCase();
}

function driveFileId(driveUrl: string): string | null {
  const m = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function driveThumbUrl(driveUrl: string, size = 400): string | null {
  const id = driveFileId(driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}

function consoleErrorCount(item: Capture): number {
  if (!Array.isArray(item.dev_logs)) return 0;
  return item.dev_logs.filter(
    (l) => l.type === "console" && l.level !== "warn" && l.level !== "warning"
  ).length;
}

function expiryToOption(expiresAt: string | null | undefined, createdAt: string): string {
  if (!expiresAt) return "never";
  const diffMs = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (diffMs <= 36 * 60 * 60 * 1000) return "24h";
  if (diffMs <= 10.5 * 24 * 60 * 60 * 1000) return "7d";
  return "never";
}

function EditModal({ capture, onClose, onSaved, userPlan }: EditModalProps) {
  const [title, setTitle] = useState(capture.title);
  const [description, setDescription] = useState(capture.description || "");
  const [password, setPassword] = useState(capture.password || "");
  const [tag, setTag] = useState(capture.tag || "");
  const [status, setStatus] = useState(capture.status || "open");
  const [expiry, setExpiry] = useState<string>(() =>
    expiryToOption(capture.expires_at, capture.created_at)
  );
  const [burnAfterRead, setBurnAfterRead] = useState(capture.burn_after_read || false);
  const [allowedDomainsText, setAllowedDomainsText] = useState(() => (capture.allowed_domains || []).join(", "));
  const [allowedIpsText, setAllowedIpsText] = useState(() => (capture.allowed_ips || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);

    let expiresAt: string | null = null;
    if (expiry === "24h") expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (expiry === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const allowed_domains = allowedDomainsText.trim() 
      ? allowedDomainsText.split(",").map(d => d.trim().toLowerCase()).filter(Boolean)
      : null;

    const allowed_ips = allowedIpsText.trim()
      ? allowedIpsText.split(",").map(ip => ip.trim()).filter(Boolean)
      : null;

    const { data, error } = await supabase
      .from("captures")
      .update({
        title: title.trim() || capture.title,
        description: description.trim() || null,
        password: password.trim() || null,
        expires_at: expiresAt,
        tag: tag || null,
        status: status || null,
        burn_after_read: burnAfterRead,
        allowed_domains,
        allowed_ips,
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
              {/* Tag */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Tag</label>
                <select
                  className={inputClasses}
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">No tag</option>
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1.5">Status</label>
                <select
                  className={inputClasses}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
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

              {/* Advanced Security Upgrades */}
              <div className="border-t border-border pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">Advanced Protection</h4>
                  {userPlan === "free" && (
                    <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">Pro Only</span>
                  )}
                </div>
                
                {/* Burn after reading */}
                <label className={`flex items-center gap-2.5 text-xs text-foreground select-none ${userPlan === "free" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={burnAfterRead}
                    disabled={userPlan === "free"}
                    onChange={(e) => setBurnAfterRead(e.target.checked)}
                    className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                  />
                  <div>
                    <p className="font-medium">Burn-after-reading</p>
                    <p className="text-[10px] text-muted leading-tight mt-0.5">Link automatically expires after the first view.</p>
                  </div>
                </label>

                {/* Domain Whitelist */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted">Domain Whitelist</label>
                  </div>
                  <input
                    type="text"
                    value={allowedDomainsText}
                    disabled={userPlan === "free"}
                    onChange={(e) => setAllowedDomainsText(e.target.value)}
                    placeholder={userPlan === "free" ? "Upgrade to Pro to restrict domains" : "e.g. tokopedia.com, gojek.com (comma separated)"}
                    className={`${inputClasses} disabled:bg-subtle disabled:text-muted/60 disabled:cursor-not-allowed`}
                  />
                  <p className="text-[9px] text-muted leading-tight mt-1">Restrict access only to users logging in with these email domains.</p>
                </div>

                {/* IP Whitelist */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted">IP Whitelist</label>
                  </div>
                  <input
                    type="text"
                    value={allowedIpsText}
                    disabled={userPlan === "free"}
                    onChange={(e) => setAllowedIpsText(e.target.value)}
                    placeholder={userPlan === "free" ? "Upgrade to Pro to restrict IPs" : "e.g. 192.168.1.1, 103.88.22.1 (comma separated)"}
                    className={`${inputClasses} disabled:bg-subtle disabled:text-muted/60 disabled:cursor-not-allowed`}
                  />
                  <p className="text-[9px] text-muted leading-tight mt-1">Only allow access from these IP addresses.</p>
                </div>
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

export default function CapturesList() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted">Loading captures...</div>}>
      <CapturesContent />
    </Suspense>
  );
}

function CapturesContent() {
  const searchParams = useSearchParams();
  const wsParam = searchParams.get("ws");
  const folderParam = searchParams.get("folder");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Capture | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [thumbFailed, setThumbFailed] = useState<Record<string, boolean>>({});
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeHoverId, setActiveHoverId] = useState<string | null>(null);
  const [shortcutCopied, setShortcutCopied] = useState(false);
  const shortcutToastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "c" && e.key !== "C") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!activeHoverId) return;
      const shareUrl = `${window.location.origin}/c/${activeHoverId}`;
      navigator.clipboard?.writeText(shareUrl).catch(() => {});
      setShortcutCopied(true);
      if (shortcutToastRef.current) clearTimeout(shortcutToastRef.current);
      shortcutToastRef.current = setTimeout(() => setShortcutCopied(false), 2000);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (shortcutToastRef.current) clearTimeout(shortcutToastRef.current);
    };
  }, [activeHoverId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (u?.user_metadata?.plan) {
        setUserPlan(u.user_metadata.plan as "free" | "pro");
      }
    });
  }, []);

  // Dropdown states: false = not actively filtering by this type.
  // If BOTH are false, we show ALL (no filter applied).
  const [typeMenuOpen, setTypeMenuOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showScreenshot, setShowScreenshot] = useState(false);
  const [filterTag, setFilterTag] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Infinite scroll / pagination state
  const PAGE_SIZE = 12;
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(0);

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      const from = pageToLoad * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (wsParam && wsParam !== "all") {
        query = query.eq("workspace_id", wsParam);
      }
      if (folderParam) {
        query = query.eq("folder_name", folderParam);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Error fetching captures:", error);
        setHasMore(false);
        return;
      }
      const items = data || [];
      setCaptures((prev) => (replace ? items : [...prev, ...items]));
      setHasMore(items.length === PAGE_SIZE);
    },
    [wsParam, folderParam]
  );

  // Initial load + reload on workspace / folder change
  useEffect(() => {
    let cancelled = false;
    pageRef.current = 0;
    setLoadingMore(false);
    (async () => {
      const from = 0;
      const to = PAGE_SIZE - 1;
      let query = supabase
        .from("captures")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      if (wsParam && wsParam !== "all") {
        query = query.eq("workspace_id", wsParam);
      }
      if (folderParam) {
        query = query.eq("folder_name", folderParam);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Error fetching captures:", error);
        setHasMore(false);
      } else if (!cancelled) {
        setCaptures(data || []);
        setHasMore((data || []).length === PAGE_SIZE);
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [wsParam, folderParam]);

  // IntersectionObserver: Callback Ref to safely load more when the sentinel enters the viewport
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();
      if (!node || !hasMore || loadingMore) return;

      const obs = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore && !loadingMore) {
            setLoadingMore(true);
            pageRef.current += 1;
            loadPage(pageRef.current, false).finally(() => setLoadingMore(false));
          }
        },
        { rootMargin: "300px" }
      );
      obs.observe(node);
      observerRef.current = obs;
    },
    [hasMore, loadingMore, loadPage]
  );

  // Displayed captures, restricted to the active workspace & folder when present.
  // Client-side filter guards against the workspace_id/folder_name column not existing
  // yet on the DB — in that case captures have no workspace_id/folder_name and all show.
  const workspaceCaptures = captures.filter(
    (c) =>
      (!wsParam ||
        wsParam === "all" ||
        c.workspace_id === undefined ||
        c.workspace_id === null ||
        c.workspace_id === wsParam) &&
      (!folderParam ||
        c.folder_name === undefined ||
        c.folder_name === null ||
        c.folder_name === folderParam)
  );

  const handleCopyLink = (id: string) => {
    const shareUrl = `${window.location.origin}/c/${id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

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

  // Bulk-select mode for deleting many captures at once.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0 || bulkDeleting) return;
    const ids = Array.from(selectedIds);
    setBulkDeleting(true);
    setDeleteError(null);
    const { error } = await supabase.from("captures").delete().in("id", ids);
    if (error) {
      console.warn("Error bulk deleting:", error);
      setDeleteError("Could not delete some captures. Please try again.");
      setBulkDeleting(false);
      return;
    }
    const removed = new Set(ids);
    setCaptures((prev) => prev.filter((c) => !removed.has(c.id)));
    setBulkDeleting(false);
    exitSelectMode();
  }

  const filteredCaptures = workspaceCaptures.filter((item) => {
    // No type selected => treat as "All" (don't filter by type).
    const matchesType =
      (!showVideo && !showScreenshot) ||
      (item.type === "video" && showVideo) ||
      (item.type === "screenshot" && showScreenshot);

    const matchesTag = !filterTag || item.tag === filterTag;
    const matchesStatus = !filterStatus || item.status === filterStatus;

    const q = search.trim().toLowerCase();
    const matchesSearch = !q ||
      item.title.toLowerCase().includes(q) ||
      (Array.isArray(item.dev_logs) &&
        item.dev_logs.some((l) =>
          [l.message, l.text, l.url, l.method]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q))
        ));

    return matchesType && matchesTag && matchesStatus && matchesSearch;
  });

  const videoCount = workspaceCaptures.filter((c) => c.type === "video").length;
  const screenshotCount = workspaceCaptures.filter((c) => c.type === "screenshot").length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {shortcutCopied && activeHoverId && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
          Copied! Press &quot;C&quot; while hovering to copy the public link.
        </div>
      )}
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">All Captures</h1>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder="Search captures..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 w-64"
            />
          </div>
          {!selectMode ? (
            <>
              <button
                onClick={() => setSelectMode(true)}
                disabled={filteredCaptures.length === 0}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm font-medium text-muted hover:text-foreground hover:bg-subtle transition-colors disabled:opacity-40"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
                Select
              </button>
              <Link
                href="/"
                title="Open the mazwayScreen extension to start a capture"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-400 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                New Capture
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted mr-1">
                {selectedIds.size} selected
              </span>
              <button
                onClick={() =>
                  setSelectedIds(
                    (prev) =>
                      new Set(
                        prev.size === filteredCaptures.length
                          ? []
                          : filteredCaptures.map((c) => c.id)
                      )
                  )
                }
                className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-muted hover:text-foreground hover:bg-subtle transition-colors"
              >
                {selectedIds.size === filteredCaptures.length && selectedIds.size > 0
                  ? "Deselect all"
                  : "Select all"}
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={selectedIds.size === 0 || bulkDeleting}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {bulkDeleting ? "Deleting…" : `Delete ${selectedIds.size || ""}`}
              </button>
              <button
                onClick={exitSelectMode}
                className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-muted hover:text-foreground hover:bg-subtle transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Row (Jam.dev style) */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-border overflow-visible">
        <div className="relative">
          <button
            onClick={() => setTypeMenuOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              typeMenuOpen || showVideo || showScreenshot
                ? "bg-subtle border-indigo-200 text-foreground"
                : "bg-white border-border text-muted hover:text-foreground hover:bg-subtle"
            }`}
          >
            <span>Type</span>
            {(showVideo || showScreenshot) && (
              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
            )}
            <svg className={`w-3.5 h-3.5 text-muted transition-transform ${typeMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {typeMenuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setTypeMenuOpen(false)} />
              <div className="absolute top-full left-0 mt-1.5 w-64 z-30 bg-white border border-border rounded-xl shadow-xl overflow-hidden">
                <div className="px-3 pt-3 pb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">Type</p>
                </div>

                {/* Screenshot row */}
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${showScreenshot ? "text-foreground" : "text-muted"}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${showScreenshot ? "bg-indigo-600 border-indigo-600" : "border-border"}`}
                    onClick={() => setShowScreenshot((v) => !v)}>
                    {showScreenshot && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <div className="w-7 h-7 rounded-md bg-rose-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium leading-none">Screenshot</p>
                    <p className="text-[11px] text-muted mt-0.5">Annotated screenshots</p>
                  </div>
                  <span className="text-xs text-muted">({screenshotCount})</span>
                </label>

                {/* Video row */}
                <label className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors text-sm ${showVideo ? "text-foreground" : "text-muted"}`}>
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${showVideo ? "bg-indigo-600 border-indigo-600" : "border-border"}`}
                    onClick={() => setShowVideo((v) => !v)}>
                    {showVideo && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                  </div>
                  <div className="w-7 h-7 rounded-md bg-indigo-100 flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4 text-indigo-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium leading-none">Video</p>
                    <p className="text-[11px] text-muted mt-0.5">Screen recordings</p>
                  </div>
                  <span className="text-xs text-muted">({videoCount})</span>
                </label>

                <div className="border-t border-border mt-1 px-3 py-2 flex justify-between">
                  <button onClick={() => { setShowVideo(true); setShowScreenshot(true); }} className="text-xs text-muted hover:text-foreground transition-colors">
                    Select all
                  </button>
                  <button onClick={() => { setShowVideo(false); setShowScreenshot(false); }} className="text-xs text-muted hover:text-foreground transition-colors">
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tag Filter */}
        <div className="flex items-center gap-1.5 text-xs border border-border bg-white rounded-lg px-2 py-1.5 text-muted hover:text-foreground hover:bg-subtle transition-colors">
          <span>Tag:</span>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
          >
            <option value="">All</option>
            {TAG_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs border border-border bg-white rounded-lg px-2 py-1.5 text-muted hover:text-foreground hover:bg-subtle transition-colors">
          <span>Status:</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
          >
            <option value="">All</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {deleteError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-600">
          {deleteError}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-white overflow-hidden animate-pulse">
              <div className="aspect-[16/10] bg-subtle" />
              <div className="p-4 flex justify-between">
                <div className="w-1/2 h-4 bg-subtle rounded" />
                <div className="w-16 h-4 bg-subtle rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredCaptures.length === 0 ? (
        <div className="py-20 text-center rounded-xl border border-dashed border-border bg-subtle/50 flex flex-col items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {search.trim() || showVideo || showScreenshot ? "No captures match your filters" : "Ready when you are"}
            </h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              {search.trim() || showVideo || showScreenshot
                ? "Try a different search or clear the type filters to see everything."
                : "Use the mazwayScreen browser extension to record or snap your screen — your first capture will appear here instantly."}
            </p>
          </div>
          {!search.trim() && !showVideo && !showScreenshot && (
            <button
              onClick={() => window.open("https://chrome.google.com/webstore", "_blank")}
              className="mt-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              Install the Extension
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCaptures.map((item) => {
            const isSelected = selectedIds.has(item.id);
            // In select mode the card becomes a clickable div; otherwise a Link.
            const CardWrapper = (selectMode ? "div" : Link) as React.ElementType;
            const cardProps = selectMode
              ? { onClick: () => toggleSelect(item.id), className: "flex flex-col flex-1 cursor-pointer group select-none" }
              : { href: `/captures/${item.id}`, className: "flex flex-col flex-1 group" };
            return (
            <div
              key={item.id}
              onMouseEnter={() => setActiveHoverId(item.id)}
              onMouseLeave={() => setActiveHoverId((prev) => (prev === item.id ? null : prev))}
              className={`relative rounded-xl border bg-white hover:shadow-sm transition-all flex flex-col ${
                isSelected ? "border-indigo-600 ring-2 ring-indigo-600/20" : "border-border"
              }`}
            >
              <CardWrapper {...cardProps}>
                {/* Thumbnail Container */}
                <div className="aspect-[16/10] rounded-t-xl overflow-hidden bg-subtle flex items-center justify-center text-muted text-sm relative group-hover:bg-subtle/80 transition-colors">
                  {driveThumbUrl(item.drive_url) && !thumbFailed[item.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={driveThumbUrl(item.drive_url)!}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      onError={() => setThumbFailed((prev) => ({ ...prev, [item.id]: true }))}
                      className="w-full h-full object-cover"
                    />
                  ) : (
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
                    </div>
                  )}

                  {/* Selection checkbox (visible only in select mode) */}
                  {selectMode && (
                    <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600"
                            : "bg-white/90 border-indigo-400"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gradient Overlay for Top Left Avatar */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 opacity-80 pointer-events-none" />

                  {/* Top-Left Avatar / Initial Badge (Jam.dev style) */}
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${getAvatarColor(item.owner_email)} text-white text-xs font-bold flex items-center justify-center shadow-sm border border-white/20`}>
                      {getOwnerInitial(item.owner_email)}
                    </div>
                    <span className="text-xs font-medium text-white drop-shadow-sm truncate max-w-[120px]">
                      {item.title}
                    </span>
                  </div>

                  {/* Status Badges container (Berjejer rapi di kanan atas, tidak overlap) */}
                  <div className="absolute top-3 right-10 flex items-center gap-1.5 z-10">
                    {item.expires_at && new Date(item.expires_at).getTime() < Date.now() && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-100 bg-red-600/80 px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
                        Expired
                      </span>
                    )}
                    {item.password && (
                      <span className="text-[10px] font-semibold text-amber-100 bg-amber-600/80 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1 shadow-sm">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        Locked
                      </span>
                    )}
                    {consoleErrorCount(item) > 0 && (
                      <span className="text-[10px] font-semibold text-red-100 bg-red-600/80 px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
                        🔴 {consoleErrorCount(item)} errors
                      </span>
                    )}
                  </div>

                  {/* Bottom Right Duration (Jam.dev style) - Only shows for video */}
                  {item.type === "video" && (
                    <div className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-sm text-white text-[11px] font-medium px-2 py-1 rounded flex items-center gap-1.5 shadow-sm">
                      <svg className="w-3.5 h-3.5 text-white fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                      <span>{formatDuration(item.duration)}</span>
                    </div>
                  )}

                  {/* Tag & Status badges (bottom left) */}
                  {item.tag && (
                    <span className="absolute bottom-2.5 left-2.5 text-[10px] font-semibold uppercase tracking-wide bg-indigo-600/90 text-white px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
                      {item.tag}
                    </span>
                  )}
                  {item.status && item.status !== "open" && (
                    <span className={`absolute bottom-2.5 ${item.tag ? "left-[calc(1rem+auto)]" : "left-2.5"} text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded backdrop-blur-sm shadow-sm ${
                      item.status === "fixed"
                        ? "bg-emerald-600/90 text-white"
                        : item.status === "in-progress"
                        ? "bg-amber-500/90 text-white"
                        : item.status === "closed"
                        ? "bg-gray-600/90 text-white"
                        : "bg-rose-600/90 text-white"
                    }`}>
                      {item.status}
                    </span>
                  )}
                </div>

                {/* Meta Footer */}
                <div className="p-3.5 flex items-center justify-between text-xs">
                  <h3 className="font-medium text-foreground truncate max-w-[190px] group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                  <span className="text-muted shrink-0">
                    {timeAgo(item.created_at)}
                  </span>
                  </div>
              </CardWrapper>

              {/* 3-dot menu - hidden in select mode */}
              {!selectMode && (
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
              )}

              {openMenuId === item.id && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                  <div className="absolute right-2.5 top-10 z-50 w-36 rounded-lg border border-border bg-white shadow-lg py-1">
                    <button
                      onClick={() => {
                        handleCopyLink(item.id);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-subtle transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
                      </svg>
                      {copiedId === item.id ? "Copied!" : "Copy Link"}
                    </button>
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
            );
          })}
        </div>
      )}

      {/* Infinite scroll sentinel + loading indicator.
          Sentinel always stays mounted so IntersectionObserver keeps working;
          it just renders nothing visually when there's nothing to load. */}
      {!loading && filteredCaptures.length > 0 && (
        <div ref={sentinelRef} className="py-8 flex items-center justify-center">
          {loadingMore && hasMore && (
            <div className="flex flex-col items-center gap-2">
              <div className="w-7 h-7 border-[3px] border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-xs text-muted">Loading more captures...</span>
            </div>
          )}
        </div>
      )}

      {editing && <EditModal capture={editing} userPlan={userPlan} onClose={() => setEditing(null)} onSaved={(updated) => setCaptures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))} />}
    </div>
  );
}
