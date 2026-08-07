"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/I18nProvider";

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
  dev_logs?: { type?: string; level?: string; message?: string; text?: string; url?: string; method?: string; count?: number }[] | { version: number; errors?: number } | null;
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

const EXPIRY_OPTIONS: { value: "never" | "24h" | "7d"; labelKey: string }[] = [
  { value: "never", labelKey: "cap.never" },
  { value: "24h", labelKey: "cap.hours24" },
  { value: "7d", labelKey: "cap.days7" },
];

function timeAgo(iso: string, t: (k: string, vars?: Record<string, string | number>) => string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("time.justNow");
  if (m < 60) return t("time.minAgo", { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("time.hrAgo", { n: h });
  const d = Math.floor(h / 24);
  if (d < 7) return t("time.dayAgo", { n: d });
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
  if (!Array.isArray(item.dev_logs)) {
    // Compact health summary shape (v1): count its errors directly.
    const s = item.dev_logs as { version?: number; errors?: number } | null | undefined;
    return typeof s?.errors === "number" ? s.errors : 0;
  }
  return item.dev_logs
    .filter((l) => l.type === "console" && l.level !== "warn" && l.level !== "warning")
    .reduce((total, log) => total + Math.max(1, Number(log.count) || 1), 0);
}

function expiryToOption(expiresAt: string | null | undefined, createdAt: string): string {
  if (!expiresAt) return "never";
  const diffMs = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (diffMs <= 36 * 60 * 60 * 1000) return "24h";
  if (diffMs <= 10.5 * 24 * 60 * 60 * 1000) return "7d";
  return "never";
}

function EditModal({ capture, onClose, onSaved, userPlan }: EditModalProps) {
  const { t } = useT();
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

    const originalExpiry = expiryToOption(capture.expires_at, capture.created_at);
    let expiresAt: string | null = expiry === originalExpiry ? capture.expires_at ?? null : null;
    if (expiry !== originalExpiry && expiry === "24h") expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    if (expiry !== originalExpiry && expiry === "7d") expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

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
      setError(t("cap.saveError"));
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
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-border flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-bold text-foreground">{t("cap.editTitle")}</h2>
          <button
            onClick={onClose}
            aria-label={t("common.close")}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.titleLabel")}</label>
            <input className={inputClasses} value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.descLabel")}</label>
            <textarea
              className={`${inputClasses} min-h-[72px] resize-none`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("cap.descPlaceholder")}
            />
          </div>

          <div className="border-t border-border pt-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">{t("cap.linkSettings")}</h3>
            <p className="text-xs text-muted mb-4">{t("cap.linkSettingsHint")}</p>

            <div className="space-y-4">
              {/* Tag */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.tagLabel")}</label>
                <select
                  className={inputClasses}
                  value={tag}
                  onChange={(e) => setTag(e.target.value)}
                >
                  <option value="">{t("cap.noTag")}</option>
                  {TAG_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.statusLabel")}</label>
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
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.passwordLabel")}</label>
                <input
                  className={inputClasses}
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("cap.passwordPlaceholder")}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">{t("cap.expiresLabel")}</label>
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
                      {t(opt.labelKey)}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted mt-1.5">
                  {expiry === "never"
                    ? t("cap.neverExpires")
                    : t("cap.expiresOn", { date: new Date(
                        Date.now() + (expiry === "24h" ? 24 : 168) * 60 * 60 * 1000
                      ).toLocaleDateString() })}
                </p>
              </div>

              {/* Advanced Security Upgrades */}
              <div className="border-t border-border pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">{t("cap.advancedProtection")}</h4>
                  {userPlan === "free" && (
                    <span className="bg-indigo-100 text-indigo-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{t("cap.proOnly")}</span>
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
                    <p className="font-medium">{t("cap.burnAfterRead")}</p>
                    <p className="text-[10px] text-muted leading-tight mt-0.5">{t("cap.burnHint")}</p>
                  </div>
                </label>

                {/* Domain Whitelist */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted">{t("cap.domainWhitelist")}</label>
                  </div>
                  <input
                    type="text"
                    value={allowedDomainsText}
                    disabled={userPlan === "free"}
                    onChange={(e) => setAllowedDomainsText(e.target.value)}
                    placeholder={userPlan === "free" ? t("cap.domainPlaceholderFree") : t("cap.domainPlaceholder")}
                    className={`${inputClasses} disabled:bg-subtle disabled:text-muted/60 disabled:cursor-not-allowed`}
                  />
                  <p className="text-[9px] text-muted leading-tight mt-1">{t("cap.domainHint")}</p>
                </div>

                {/* IP Whitelist */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-muted">{t("cap.ipWhitelist")}</label>
                  </div>
                  <input
                    type="text"
                    value={allowedIpsText}
                    disabled={userPlan === "free"}
                    onChange={(e) => setAllowedIpsText(e.target.value)}
                    placeholder={userPlan === "free" ? t("cap.ipPlaceholderFree") : t("cap.ipPlaceholder")}
                    className={`${inputClasses} disabled:bg-subtle disabled:text-muted/60 disabled:cursor-not-allowed`}
                  />
                  <p className="text-[9px] text-muted leading-tight mt-1">{t("cap.ipHint")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          {error && <p className="mr-auto text-xs text-red-600">{error}</p>}
          <button
            onClick={onClose}
            className="rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors"
          >
            {saving ? t("settings.saving") : t("cap.saveChanges")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CapturesList() {
  const { t } = useT();
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted">{t("cap.loading")}</div>}>
      <CapturesContent />
    </Suspense>
  );
}

function CapturesContent() {
  const { t } = useT();
  const searchParams = useSearchParams();
  const wsParam = searchParams.get("ws");
  const folderParam = searchParams.get("folder");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Capture | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<{ ids: string[]; title?: string; operationId: string } | null>(null);
  const [deleteMode, setDeleteMode] = useState<"drive_trash" | "BugSnap_only">("drive_trash");
  const [deleting, setDeleting] = useState(false);
  const [driveNotConnected, setDriveNotConnected] = useState(false);
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
      const shareUrl = `${window.location.origin}/v/${activeHoverId}`;
      navigator.clipboard?.writeText(shareUrl).then(() => {
        setShortcutCopied(true);
        if (shortcutToastRef.current) clearTimeout(shortcutToastRef.current);
        shortcutToastRef.current = setTimeout(() => setShortcutCopied(false), 2000);
      }).catch(() => setDeleteError(t("cap.copyError")));
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (shortcutToastRef.current) clearTimeout(shortcutToastRef.current);
    };
  }, [activeHoverId, t]);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) return;
      let plan = (u.user_metadata?.plan || "free") as "free" | "pro";
      // Prefer plan from public.users (source of truth via Stripe webhook)
      if (u.email) {
        const { data: userRow } = await supabase
          .from("users")
          .select("plan")
          .ilike("email", u.email)
          .maybeSingle();
        if (userRow?.plan === "pro") plan = "pro";
      }
      setUserPlan(plan);
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
  // Bumped on every filter change; in-flight loadPage() from an old filter
  // that resolves afterwards is discarded (no stale append to the new list).
  const loadGenRef = useRef(0);

  // Explicit column list (no dev_logs) keeps the grid fast — logs are only
  // needed on the detail page.
  const CAPTURES_COLUMNS =
    "id, title, type, drive_url, created_at, window_size, workspace_id, folder_name, tag, status, expires_at, password, duration, owner_email, burn_after_read";

  const loadPage = useCallback(
    async (pageToLoad: number, replace: boolean) => {
      const gen = loadGenRef.current;
      const from = pageToLoad * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("captures")
        .select(CAPTURES_COLUMNS)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (wsParam && wsParam !== "all") {
        query = query.eq("workspace_id", wsParam);
      }
      if (folderParam) {
        query = query.eq("folder_name", folderParam);
      }
      const { data, error } = await query;
      // Stale response for a filter that changed mid-flight — drop it.
      if (gen !== loadGenRef.current) return;
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
    loadGenRef.current += 1;
    setLoadingMore(false);
    setLoading(true);
    (async () => {
      const from = 0;
      const to = PAGE_SIZE - 1;
      let query = supabase
        .from("captures")
        .select(CAPTURES_COLUMNS)
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

  // The Supabase query already applies workspace_id/folder_name filters server-side
  // (see the fetch effect above), so no redundant client-side re-filter is needed here.
  const workspaceCaptures = captures;

  const handleCopyLink = async (id: string) => {
    setDeleteError(null);
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/v/${id}`);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setDeleteError(t("cap.copyError"));
    }
  };

  function openDeleteConfirmation(ids: string[], title?: string) {
    if (ids.length === 0 || deleting) return;
    setDeleteMode("drive_trash");
    setDriveNotConnected(false);
    setDeleteError(null);
    setDeleteRequest({ ids, title, operationId: crypto.randomUUID() });
    setOpenMenuId(null);
  }

  async function submitDelete() {
    if (!deleteRequest || deleting) return;
    setDeleting(true);
    setDriveNotConnected(false);
    setDeleteError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (sessionError || !token) throw new Error(t("cap.sessionExpired"));

      const response = await fetch("/api/google-drive/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ captureIds: deleteRequest.ids, mode: deleteMode, operationId: deleteRequest.operationId }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        deletedIds?: string[];
        deleted_ids?: string[];
        failedIds?: string[];
        failed_ids?: string[];
        results?: Array<{ captureId: string; ok: boolean; error?: string }>;
        error?: string;
        message?: string;
        code?: string;
      };
      const deletedIds = result.deletedIds ?? result.deleted_ids ?? result.results?.filter((item) => item.ok).map((item) => item.captureId) ?? [];
      const failedIds = result.failedIds ?? result.failed_ids ?? result.results?.filter((item) => !item.ok).map((item) => item.captureId) ?? [];
      const disconnected = response.status === 409 || result.code === "DRIVE_NOT_CONNECTED" || /drive.*not connected/i.test(result.error ?? result.message ?? "");

      if (deletedIds.length > 0) {
        const removed = new Set(deletedIds);
        setCaptures((prev) => prev.filter((capture) => !removed.has(capture.id)));
        setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => !removed.has(id))));
      }
      if (disconnected) {
        setDriveNotConnected(true);
        setDeleteError(t("cap.driveNotConnected"));
        return;
      }
      if (!response.ok || failedIds.length > 0) {
        setDeleteError(result.error ?? result.message ?? t("cap.deleteFailed"));
        if (deletedIds.length > 0) setDeleteRequest({
          ids: failedIds.length ? failedIds : deleteRequest.ids.filter((id) => !deletedIds.includes(id)),
          operationId: deleteRequest.operationId,
        });
        return;
      }

      setDeleteRequest(null);
      if (selectMode) exitSelectMode();
    } catch (error) {
      console.warn("Error deleting captures:", error);
      setDeleteError(error instanceof Error ? error.message : "Could not delete the selected captures. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  // Bulk-select mode for deleting many captures at once.
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const filteredCaptures = workspaceCaptures.filter((item) => {
    // No type selected => treat as "All" (don't filter by type).
    const matchesType =
      (!showVideo && !showScreenshot) ||
      (item.type === "video" && showVideo) ||
      (item.type === "screenshot" && showScreenshot);

    const matchesTag = !filterTag || item.tag === filterTag;
    const matchesStatus = !filterStatus || item.status === filterStatus;

    const q = search.trim().toLowerCase();
    const matchesSearch = !q || item.title.toLowerCase().includes(q);

    return matchesType && matchesTag && matchesStatus && matchesSearch;
  });

  const videoCount = workspaceCaptures.filter((c) => c.type === "video").length;
  const screenshotCount = workspaceCaptures.filter((c) => c.type === "screenshot").length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {shortcutCopied && activeHoverId && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-medium px-3 py-2 rounded-lg shadow-lg">
          {t("cap.copiedShortcut")}
        </div>
      )}
      {/* Header & Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("cap.title")}</h1>

        <div className="flex items-center gap-4">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            <input
              type="text"
              placeholder={t("cap.search")}
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
                {t("cap.select")}
              </button>
              <Link
                href="/"
                title="Open the BugSnap extension to start a capture"
                className="flex items-center gap-2 px-4 py-2 bg-emerald-400 text-white text-sm font-medium rounded-lg hover:bg-emerald-500 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                {t("cap.newCapture")}
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted mr-1">
                {t("cap.selected", { count: selectedIds.size })}
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
                  ? t("cap.deselectAll")
                  : t("cap.selectAll")}
              </button>
              <button
                onClick={() => openDeleteConfirmation(Array.from(selectedIds))}
                disabled={selectedIds.size === 0 || deleting}
                className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {t("cap.deleteSelected", { count: selectedIds.size || "" })}
              </button>
              <button
                onClick={exitSelectMode}
                className="px-3 py-2 rounded-lg border border-border bg-white text-xs font-medium text-muted hover:text-foreground hover:bg-subtle transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filter Row (Jam.dev style) - sticky so filters stay accessible while scrolling */}
      <div className="sticky top-0 z-10 flex items-center gap-3 mb-6 pb-4 pt-3 border-b border-border overflow-visible bg-background/95 backdrop-blur-sm">
        <div className="relative">
          <button
            onClick={() => setTypeMenuOpen((o) => !o)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
              typeMenuOpen || showVideo || showScreenshot
                ? "bg-subtle border-indigo-200 text-foreground"
                : "bg-white border-border text-muted hover:text-foreground hover:bg-subtle"
            }`}
          >
            <span>{t("cap.type")}</span>
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
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t("cap.type")}</p>
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
                    <p className="font-medium leading-none">{t("cap.screenshot")}</p>
                    <p className="text-[11px] text-muted mt-0.5">{t("cap.screenshotHint")}</p>
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
                    <p className="font-medium leading-none">{t("cap.video")}</p>
                    <p className="text-[11px] text-muted mt-0.5">{t("cap.videoHint")}</p>
                  </div>
                  <span className="text-xs text-muted">({videoCount})</span>
                </label>

                <div className="border-t border-border mt-1 px-3 py-2 flex justify-between">
                  <button onClick={() => { setShowVideo(true); setShowScreenshot(true); }} className="text-xs text-muted hover:text-foreground transition-colors">
                    {t("cap.selectAll")}
                  </button>
                  <button onClick={() => { setShowVideo(false); setShowScreenshot(false); }} className="text-xs text-muted hover:text-foreground transition-colors">
                    {t("cap.clear")}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Tag Filter */}
        <div className="flex items-center gap-1.5 text-xs border border-border bg-white rounded-lg px-2 py-1.5 text-muted hover:text-foreground hover:bg-subtle transition-colors">
          <span>{t("cap.tagFilter")}</span>
          <select
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
            className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
          >
            <option value="">{t("cap.all")}</option>
            {TAG_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5 text-xs border border-border bg-white rounded-lg px-2 py-1.5 text-muted hover:text-foreground hover:bg-subtle transition-colors">
          <span>{t("cap.statusFilter")}</span>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-transparent font-medium text-foreground outline-none cursor-pointer"
          >
            <option value="">{t("cap.all")}</option>
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
              {search.trim() || showVideo || showScreenshot ? t("cap.noMatch") : t("cap.empty")}
            </h3>
            <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
              {search.trim() || showVideo || showScreenshot
                ? t("cap.noMatchHint")
                : t("cap.emptyHint")}
            </p>
          </div>
          {!search.trim() && !showVideo && !showScreenshot && (
            <button
              onClick={() => window.open("https://github.com/himawari19/BugSnap", "_blank")}
              className="mt-1 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              {t("cap.install")}
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
              : { href: `/v/${item.id}`, className: "flex flex-col flex-1 group" };
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
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={driveThumbUrl(item.drive_url)!}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        onError={() => setThumbFailed((prev) => ({ ...prev, [item.id]: true }))}
                        className="w-full h-full object-cover"
                      />
                      {/* Play overlay for videos so the grid clearly shows what's a recording */}
                      {item.type === "video" ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/25 group-hover:bg-black/40 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                            <svg className="w-5 h-5 text-indigo-600 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 bg-black/25 group-hover:bg-black/40 transition-colors" />
                      )}
                    </>
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
                        {t("cap.expired")}
                      </span>
                    )}
                    {item.password && (
                      <span className="text-[10px] font-semibold text-amber-100 bg-amber-600/80 px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1 shadow-sm">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
                        {t("cap.locked")}
                      </span>
                    )}
                    {consoleErrorCount(item) > 0 && (
                      <span className="text-[10px] font-semibold text-red-100 bg-red-600/80 px-2 py-0.5 rounded backdrop-blur-sm shadow-sm">
                        🔴 {t("cap.errors", { count: consoleErrorCount(item) })}
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
                    {timeAgo(item.created_at, t)}
                  </span>
                  </div>
              </CardWrapper>

              {/* 3-dot menu - hidden in select mode */}
              {!selectMode && (
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                  <button
                    aria-label={t("cap.copyLink")}
                    title={t("cap.copyLink")}
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCopyLink(item.id); }}
                    className="w-7 h-7 rounded-md bg-white/90 border border-border text-muted hover:text-emerald-600 hover:bg-emerald-50 flex items-center justify-center shadow-sm transition-colors"
                  >
                    {copiedId === item.id ? (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                    )}
                  </button>
                  <button
                    aria-label="Capture actions"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
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
                      {copiedId === item.id ? t("cap.copied") : t("cap.copyLink")}
                    </button>
                    <button
                      onClick={() => {
                        setEditing(item);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-subtle transition-colors"
                    >
                      <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      {t("cap.edit")}
                    </button>
                    <button
                      onClick={() => openDeleteConfirmation([item.id], item.title)}
                      disabled={deleting}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" /></svg>
                      {t("cap.delete")}
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
              <span className="text-xs text-muted">{t("cap.loadingMore")}</span>
            </div>
          )}
        </div>
      )}

      {editing && <EditModal capture={editing} userPlan={userPlan} onClose={() => setEditing(null)} onSaved={(updated) => setCaptures((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))} />}

      {deleteRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="delete-captures-title">
          <button className="absolute inset-0 bg-black/40" aria-label="Close confirmation" onClick={() => !deleting && setDeleteRequest(null)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-border p-6">
            <div className="mb-4 w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h2 id="delete-captures-title" className="text-lg font-bold text-foreground mb-1">
              {deleteRequest.ids.length === 1 ? t("cap.deleteTitleOne") : t("cap.deleteTitleMany", { count: deleteRequest.ids.length })}
            </h2>
            <p className="text-sm text-muted mb-5">
              {deleteRequest.title ? <>{t("cap.deleteWillRemove", { name: deleteRequest.title })}</> : t("cap.deleteChoose")}
            </p>

            <div className="space-y-2">
              <label className={`block rounded-lg border p-3 cursor-pointer ${deleteMode === "drive_trash" ? "border-indigo-500 bg-indigo-50/50" : "border-border"}`}>
                <span className="flex gap-3">
                  <input type="radio" name="delete-mode" value="drive_trash" checked={deleteMode === "drive_trash"} onChange={() => { setDeleteMode("drive_trash"); setDeleteRequest((request) => request ? { ...request, operationId: crypto.randomUUID() } : request); }} disabled={deleting} className="mt-1" />
                  <span><span className="block text-sm font-semibold text-foreground">{t("cap.moveToTrash")}</span><span className="block text-xs text-muted mt-0.5">{t("cap.trashHint")}</span></span>
                </span>
              </label>
              <label className={`block rounded-lg border p-3 cursor-pointer ${deleteMode === "BugSnap_only" ? "border-indigo-500 bg-indigo-50/50" : "border-border"}`}>
                <span className="flex gap-3">
                  <input type="radio" name="delete-mode" value="BugSnap_only" checked={deleteMode === "BugSnap_only"} onChange={() => { setDeleteMode("BugSnap_only"); setDeleteRequest((request) => request ? { ...request, operationId: crypto.randomUUID() } : request); setDriveNotConnected(false); setDeleteError(null); }} disabled={deleting} className="mt-1" />
                  <span><span className="block text-sm font-semibold text-foreground">{t("cap.BugSnapOnly")}</span><span className="block text-xs text-muted mt-0.5">{t("cap.BugSnapOnlyHint")}</span></span>
                </span>
              </label>
            </div>

            {deleteError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{deleteError}</div>}
            {driveNotConnected && (
              <div className="mt-3 flex items-center gap-3">
                <Link href="/settings" className="text-sm font-semibold text-indigo-600 hover:underline">{t("cap.connectDrive")}</Link>
                <button onClick={() => { setDeleteMode("BugSnap_only"); setDriveNotConnected(false); setDeleteError(null); }} className="text-sm font-medium text-foreground hover:underline">{t("cap.useBugSnapOnly")}</button>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button onClick={() => setDeleteRequest(null)} disabled={deleting} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg disabled:opacity-50 transition-colors">{t("common.cancel")}</button>
              <button onClick={submitDelete} disabled={deleting} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleting ? t("layout.deleting") : t("cap.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
