"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import DevToolsPanel, { DevLog } from "@/components/DevToolsPanel";
import Comments from "@/components/Comments";
import MediaViewer from "@/components/MediaViewer";

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
  workspace_id?: string | null;
  tag?: string | null;
  status?: string | null;
  allowed_domains?: string[] | null;
  allowed_ips?: string[] | null;
  burn_after_read?: boolean;
  expires_at?: string | null;
}

const TAG_OPTIONS = ["bug", "feature-request", "wip", "design", "other"];
const STATUS_OPTIONS = ["open", "in-progress", "fixed", "closed"];

function getExpiryCountdown(expiresAt: string): string {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 24) {
    if (hours < 2) return "Expires in under 1 hour";
    return `Expires in ${hours} hours`;
  }
  const days = Math.ceil(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function SingleViewContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id;

  const hideDevTools = searchParams.get("devtools") === "false" || searchParams.get("embed") === "true";

  const [capture, setCapture] = useState<Capture | null>(null);
  const [status, setStatus] = useState<"loading" | "locked" | "expired" | "notfound" | "unauthorized_ip" | "needs_login" | "unauthorized_domain" | "ready">("loading");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [checkingPassword, setCheckingPassword] = useState(false);
  const [viewCount, setViewCount] = useState<number | null>(null);
  const recordedViewRef = useRef<string | null>(null);

  // Modals & Popovers
  const [moreOpen, setMoreOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareType, setShareType] = useState<"devtools" | "content">("devtools");
  const [aiModal, setAiModal] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiCopied, setAiCopied] = useState(false);
  const [embedModal, setEmbedModal] = useState(false);
  const [embedCopied, setEmbedCopied] = useState(false);
  const [deleteCaptureModalOpen, setDeleteCaptureModalOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"drive_trash" | "mazway_only">("drive_trash");
  const [deletingCapture, setDeletingCapture] = useState(false);
  const [deleteCaptureError, setDeleteCaptureError] = useState<string | null>(null);
  const [driveNotConnected, setDriveNotConnected] = useState(false);
  const [deleteOperationId, setDeleteOperationId] = useState<string | null>(null);

  // Edit / Delete for internal workspace members
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [isWorkspaceOwner, setIsWorkspaceOwner] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editTag, setEditTag] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editAllowedDomains, setEditAllowedDomains] = useState("");
  const [editAllowedIps, setEditAllowedIps] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [viewerEmail, setViewerEmail] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [brand, setBrand] = useState({ name: "mazway", logo: "", hideWatermark: false });

  // 1. Initial Access Check (Non-Login default)
  useEffect(() => {
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

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      setStatus("notfound");
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setIsAuthenticated(!!data.session?.user);
      setViewerEmail(data.session?.user?.email ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setIsAuthenticated(!!session?.user);
      setViewerEmail(session?.user?.email ?? null);
    });

    supabase
      .rpc("get_public_capture", { p_id: id, p_password: null })
      .then(async ({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.length === 0) { setStatus("notfound"); return; }

        const row = data[0] as Capture & { status: string };
        
        // Check if the user is a logged-in member to bypass password/whitelist gates
        let bypass = false;
        try {
          const { data: authData } = await supabase.auth.getSession();
          const userId = authData.session?.user?.id;
          if (userId) {
          // get_public_capture does NOT return workspace_id, so fetch it directly
          // from the captures table (member-scoped, safe via RLS).
          let wsId = row.workspace_id || null;
          if (!wsId) {
            const { data: wsData } = await supabase
              .from("captures")
              .select("workspace_id")
              .eq("id", id)
              .single();
            wsId = (wsData as { workspace_id: string } | null)?.workspace_id || null;
          }

          if (wsId) {
            const { data: members } = await supabase.rpc("get_workspace_members", {
              p_workspace_id: wsId,
            });
            const memberList = (members ?? []) as { user_id: string; role?: string }[];
            const currentMember = memberList.find((member) => member.user_id === userId);
            if (currentMember) {
              bypass = true;
              setIsTeamMember(true);
              setIsWorkspaceOwner(currentMember.role === "owner");
            }
          }
          }
        } catch {}

        if (bypass) {
          // Force bypass password/domain whitelists for authenticated workspace members
          const { data: directData } = await supabase
            .from("captures")
            .select("*")
            .eq("id", id)
            .single();
          if (directData && !cancelled) {
            setCapture(directData as Capture);
            setStatus("ready");
          }
          return;
        }

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

    supabase.rpc("get_view_count", { p_capture_id: id }).then(({ data }) => {
      if (!cancelled && data != null) setViewCount(Number(data));
    });

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [id]);

  // 2. View Tracking Effect
  useEffect(() => {
    if (!id || !capture || status !== "ready") return;
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
  }, [id, capture, status]);

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

        const row = data[0] as Capture & { status: string };
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
          setCapture(row);
          setPasswordError(true);
        }
      });
  }

  async function handleGenerateAiReport() {
    setAiModal(true);
    if (aiSummary) return;
    setAiLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (authError || !token) throw new Error("Sign in to generate an AI report.");
      const res = await fetch("/api/ai-bug-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: capture?.title,
          devLogs: capture?.dev_logs,
          windowSize: capture?.window_size,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(res.status === 401 ? "Sign in to generate an AI report." : json.error || "Failed to generate AI report.");
      if (json.summary) setAiSummary(json.summary);
    } catch (error) {
      setAiSummary(error instanceof Error ? error.message : "Failed to generate AI report.");
    } finally {
      setAiLoading(false);
    }
  }

  async function handleCopyLink() {
    if (!capture) return;
    try {
      const url = shareType === "content"
        ? `${window.location.origin}/v/${capture.id}?devtools=false`
        : `${window.location.origin}/v/${capture.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Clipboard permission was denied. Please copy the link from the address bar.");
    }
  }

  // Edit / Delete logic
  function openEditModal() {
    if (!capture) return;
    setEditTitle(capture.title || "");
    setEditDesc(capture.description || "");
    setEditTag(capture.tag || "");
    setEditStatus(capture.status || "open");
    setEditAllowedDomains((capture.allowed_domains || []).join(", "));
    setEditAllowedIps((capture.allowed_ips || []).join(", "));
    setEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!capture || savingEdit) return;
    setSavingEdit(true);
    setEditError(null);
    try {
      const parsedDomains = editAllowedDomains.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
      const parsedIps = editAllowedIps.split(",").map((s) => s.trim()).filter(Boolean);

      const { data, error } = await supabase
        .from("captures")
        .update({
          title: editTitle.trim() || capture.title,
          description: editDesc.trim() || null,
          tag: editTag || null,
          status: editStatus || null,
          allowed_domains: parsedDomains.length > 0 ? parsedDomains : null,
          allowed_ips: parsedIps.length > 0 ? parsedIps : null,
        })
        .eq("id", capture.id)
        .select()
        .single();
      if (error) throw error;
      setCapture(data as Capture);
      setEditModalOpen(false);
    } catch (err) {
      console.warn("Failed to save captures changes:", err);
      setEditError("Could not save changes. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeleteCapture() {
    if (!capture || !isWorkspaceOwner) return;
    setDeleteMode("drive_trash");
    setDeleteCaptureError(null);
    setDriveNotConnected(false);
    setDeleteOperationId(crypto.randomUUID());
    setDeleteCaptureModalOpen(true);
  }

  async function submitDeleteCapture() {
    if (!capture || !isWorkspaceOwner || deletingCapture || !deleteOperationId) return;
    setDeletingCapture(true);
    setDeleteCaptureError(null);
    setDriveNotConnected(false);
    try {
      const { data, error } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (error || !token) throw new Error("Sign in again to delete this capture.");

      const response = await fetch("/api/google-drive/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ captureIds: [capture.id], mode: deleteMode, operationId: deleteOperationId }),
      });
      const result = await response.json().catch(() => ({})) as {
        results?: Array<{ captureId: string; ok: boolean; error?: string }>;
        error?: string;
      };
      const captureResult = result.results?.find((item) => item.captureId === capture.id);
      if (captureResult?.ok) {
        setDeleteCaptureModalOpen(false);
        setDeleteOperationId(null);
        router.push("/captures");
        return;
      }

      const isDriveNotConnected = response.status === 409 || /drive.*not connected/i.test(result.error || "");
      if (isDriveNotConnected) setDriveNotConnected(true);
      throw new Error(captureResult?.error || result.error || "Could not delete this capture. Please try again.");
    } catch (err) {
      console.warn("Failed to delete capture:", err);
      setDeleteCaptureError(err instanceof Error ? err.message : "Could not delete this capture. Please try again.");
    } finally {
      setDeletingCapture(false);
    }
  }

  const embedUrl = typeof window !== "undefined" ? `${window.location.origin}/v/${id}?embed=true` : "";
  const embedCode = `<iframe src="${embedUrl}" width="640" height="360" frameborder="0" allowfullscreen></iframe>`;

  return (
    <div className="h-screen bg-white flex flex-col font-sans overflow-y-auto lg:overflow-hidden">
      <header className="h-14 border-b border-border px-3 sm:px-6 flex items-center justify-between shrink-0 bg-white">
        <div className="flex items-center gap-2">
          {brand.logo ? (
            <img src={brand.logo} alt="" className="h-6 w-auto object-contain" />
          ) : (
            <span className="text-base font-bold tracking-tight text-foreground">{brand.name}</span>
          )}
          {!brand.hideWatermark && (
            <span className="hidden sm:inline-block text-[10px] font-semibold text-muted bg-subtle px-1.5 py-0.5 rounded">Screen Recorder</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3">
          {isTeamMember && (
            <Link
              href="/captures"
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-foreground hover:bg-subtle flex items-center gap-1.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              <span className="hidden md:inline">Back to Dashboard</span>
            </Link>
          )}

          {status === "ready" && (
            <button
              onClick={handleGenerateAiReport}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <span>✨ <span className="hidden sm:inline">AI Bug Report</span><span className="sm:hidden">AI</span></span>
            </button>
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
                <div className="absolute right-0 top-full mt-1.5 w-40 z-50 bg-white border border-border rounded-xl shadow-xl py-1 px-1 flex flex-col gap-0.5">
                  {status === "ready" && (
                    <button
                      onClick={() => { setEmbedModal(true); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                    >
                      Embed
                    </button>
                  )}
                  {isTeamMember && (
                    <button
                      onClick={() => { openEditModal(); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg transition-colors"
                    >
                      Edit Capture
                    </button>
                  )}
                  {isWorkspaceOwner && (
                    <button
                      onClick={() => { handleDeleteCapture(); setMoreOpen(false); }}
                      className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 font-semibold rounded-lg transition-colors"
                    >
                      Delete Capture
                    </button>
                  )}
                  {isAuthenticated === false && (
                    <a
                      href="/"
                      onClick={() => setMoreOpen(false)}
                      className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-subtle rounded-lg transition-colors"
                    >
                      Login
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Split Copy Link Button */}
          <div className="relative flex items-center">
            <button
              onClick={handleCopyLink}
              className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-white text-xs font-semibold rounded-l-lg transition-colors border-r border-emerald-500/20"
            >
              {copied ? "Copied!" : "Copy link"}
            </button>
            <button
              onClick={() => setShareOpen(!shareOpen)}
              className="px-2 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-white text-xs rounded-r-lg transition-colors flex items-center justify-center self-stretch"
              aria-label="Share options"
            >
              <svg className={`w-3 h-3 transition-transform ${shareOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Share Popover */}
            {shareOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShareOpen(false)} />
                <div className="absolute right-0 top-full mt-2 w-72 z-50 bg-white border border-border rounded-xl shadow-2xl p-4 flex flex-col gap-4 text-foreground">
                  <div>
                    <h3 className="text-[11px] font-bold text-muted uppercase tracking-wider">Share Capture</h3>
                  </div>

                  {/* Share Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setShareType("devtools")}
                      className={`p-2.5 rounded-lg border-2 text-left flex flex-col gap-1 transition-all ${
                        shareType === "devtools"
                          ? "border-indigo-600 bg-indigo-50/20"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="bg-indigo-100/60 rounded p-1 w-fit">
                        <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-bold">With DevTools</span>
                      <span className="text-[8px] text-muted leading-tight">Includes logs, console, and steps</span>
                    </button>

                    <button
                      onClick={() => setShareType("content")}
                      className={`p-2.5 rounded-lg border-2 text-left flex flex-col gap-1 transition-all ${
                        shareType === "content"
                          ? "border-indigo-600 bg-indigo-50/20"
                          : "border-border hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className="bg-emerald-100/60 rounded p-1 w-fit">
                        <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className="text-[10px] font-bold">Content Only</span>
                      <span className="text-[8px] text-muted leading-tight">Clean layout without side logs panel</span>
                    </button>
                  </div>

                  {/* General Access Selection */}
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-muted uppercase tracking-wider">General Access</label>
                    <div className="relative">
                      <select 
                        disabled
                        className="w-full bg-subtle border border-border rounded-lg pl-2 pr-7 py-1.5 text-xs text-foreground outline-none font-medium appearance-none cursor-not-allowed"
                      >
                        <option>Anyone with the link</option>
                      </select>
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-muted">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m19 9-7 7-7-7"/></svg>
                      </div>
                    </div>
                  </div>

                  {/* Copy Link Button */}
                  <button
                    onClick={handleCopyLink}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                    {copied ? "Copied Link!" : "Copy Link"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {status !== "ready" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {status === "loading" && (
            <div className="w-full max-w-5xl flex flex-col gap-6 animate-pulse">
              <div className="h-[clamp(16rem,40vh,28rem)] sm:h-[clamp(28rem,72vh,60rem)] bg-subtle rounded-2xl border border-border/70" />
              <div className="h-40 bg-subtle rounded-xl border border-border/70" />
            </div>
          )}

          {status === "notfound" && (
            <div className="text-center max-w-sm">
              <svg className="w-12 h-12 mx-auto text-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-lg font-semibold text-foreground">Capture not found</h1>
              <p className="text-sm text-muted mt-1 mb-4">The link you opened doesn&apos;t exist.</p>
              <Link href="/" className="text-sm text-indigo-600 font-medium hover:underline">← Login to Mazway</Link>
            </div>
          )}

          {status === "expired" && (
            <div className="text-center max-w-sm">
              <svg className="w-12 h-12 mx-auto text-muted/40 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h1 className="text-lg font-semibold text-foreground">Link has expired</h1>
              <p className="text-sm text-muted mt-1 mb-4">This capture is no longer available.</p>
              <Link href="/" className="text-sm text-indigo-600 font-medium hover:underline">← Login to Mazway</Link>
            </div>
          )}

          {status === "unauthorized_ip" && (
            <div className="text-center max-w-sm">
              <h1 className="text-lg font-semibold text-foreground">Access Restricted</h1>
              <p className="text-sm text-muted mt-1">Your IP address is not authorized.</p>
            </div>
          )}

          {status === "needs_login" && (
            <div className="text-center max-w-sm">
              <h1 className="text-lg font-semibold text-foreground">Login Required</h1>
              <p className="text-sm text-muted mt-1 mb-6">This link is restricted to specific domains.</p>
              <a href="/" className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-semibold">Sign In</a>
            </div>
          )}

          {status === "unauthorized_domain" && (
            <div className="text-center max-w-sm">
              <h1 className="text-lg font-semibold text-foreground">Access Denied</h1>
              <p className="text-sm text-muted mt-1">Your domain is not authorized.</p>
            </div>
          )}

          {status === "locked" && (
            <div className="w-full max-w-sm text-center">
              <h1 className="text-lg font-semibold text-foreground mb-4">Password Protected</h1>
              <form onSubmit={submitPassword} className="flex flex-col gap-3">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  placeholder="Password"
                  className={`w-full text-sm rounded-lg border px-3 py-2.5 outline-none bg-white ${passwordError ? "border-red-400" : "border-border focus:border-indigo-500"}`}
                />
                {passwordError && <p className="text-xs text-red-600 text-left">Incorrect password.</p>}
                <button type="submit" disabled={checkingPassword} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
                  {checkingPassword ? "Unlocking..." : "Unlock"}
                </button>
              </form>
            </div>
          )}
        </div>
      )}

      {status === "ready" && capture && (
        <div className="flex-1 flex flex-col lg:flex-row lg:overflow-hidden min-h-0">
          <div className="flex-1 lg:overflow-y-auto p-4 sm:p-6 flex flex-col gap-6">
            <MediaViewer type={capture.type} driveUrl={capture.drive_url} title={capture.title} />

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
                  {capture.drive_url && (
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {capture.drive_url && (
                        <a
                          href={capture.drive_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-[11px] text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6v6M10 14L20 4" />
                          </svg>
                          Drive Link
                        </a>
                      )}
                    </div>
                  )}
                </div>
                {viewCount !== null && <span className="shrink-0 text-xs text-muted whitespace-nowrap mt-0.5">👁 {viewCount} views</span>}
              </div>

              <div className="pt-2 border-t border-border/40">
                <Comments captureId={capture.id} isVideo={capture.type === "video"} authorName={viewerEmail ? viewerEmail.split("@")[0] : undefined} authorEmail={viewerEmail || undefined} />
              </div>
            </div>
          </div>

          {!hideDevTools && (
            <DevToolsPanel capture={capture as unknown as React.ComponentProps<typeof DevToolsPanel>["capture"]} />
          )}
        </div>
      )}

      {/* Edit Modal (Workspace Members only) */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-base font-bold text-foreground mb-4">Edit Capture</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Title</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted mb-1.5">Description</label>
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white min-h-[72px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Tag</label>
                  <select value={editTag} onChange={(e) => setEditTag(e.target.value)} className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white">
                    <option value="">No tag</option>
                    {TAG_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1.5">Status</label>
                  <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)} className="w-full text-sm rounded-lg border border-border px-3 py-2 bg-white">
                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Allowed Email Domains (Enterprise Security)</label>
                  <input
                    type="text"
                    value={editAllowedDomains}
                    onChange={(e) => setEditAllowedDomains(e.target.value)}
                    placeholder="e.g. company.com, partner.com"
                    className="w-full text-xs font-mono rounded-lg border border-border px-3 py-2 bg-white"
                  />
                  <p className="text-[10px] text-muted mt-1">Restricts access to viewers logged in with matching email domain.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted mb-1">Allowed IP Addresses</label>
                  <input
                    type="text"
                    value={editAllowedIps}
                    onChange={(e) => setEditAllowedIps(e.target.value)}
                    placeholder="e.g. 180.252.1.2, 10.0.0.1"
                    className="w-full text-xs font-mono rounded-lg border border-border px-3 py-2 bg-white"
                  />
                  <p className="text-[10px] text-muted mt-1">Restricts access to specific network IPs.</p>
                </div>
              </div>
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
              <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 text-xs font-medium text-muted hover:text-foreground">Cancel</button>
              <button onClick={handleSaveEdit} disabled={savingEdit} className="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50">
                {savingEdit ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Embed Modal */}
      {embedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEmbedModal(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">Embed Capture</h3>
              <button onClick={() => setEmbedModal(false)} className="text-muted hover:text-foreground">✕</button>
            </div>
            <textarea readOnly value={embedCode} className="w-full h-20 text-xs font-mono p-2 bg-subtle border border-border rounded-lg outline-none resize-none" />
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

      {/* Delete Capture Modal */}
      {deleteCaptureModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => { if (!deletingCapture) { setDeleteCaptureModalOpen(false); setDeleteOperationId(null); } }} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Delete Capture?</h2>
            <p className="text-xs text-muted leading-relaxed mb-4">
              Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{capture?.title}&quot;</span>?
            </p>
            <fieldset className="space-y-2 text-left mb-4" disabled={deletingCapture}>
              <legend className="text-xs font-semibold text-foreground mb-2">Delete from</legend>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <input type="radio" name="delete-mode" value="drive_trash" checked={deleteMode === "drive_trash"} onChange={() => { setDeleteMode("drive_trash"); setDeleteOperationId(crypto.randomUUID()); }} className="mt-0.5" />
                <span><span className="block text-xs font-semibold text-foreground">Move to Drive trash + delete from Mazway</span><span className="block text-[11px] text-muted mt-0.5">Default. The Drive file can still be restored from trash.</span></span>
              </label>
              <label className="flex items-start gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <input type="radio" name="delete-mode" value="mazway_only" checked={deleteMode === "mazway_only"} onChange={() => { setDeleteMode("mazway_only"); setDeleteOperationId(crypto.randomUUID()); setDriveNotConnected(false); setDeleteCaptureError(null); }} className="mt-0.5" />
                <span><span className="block text-xs font-semibold text-foreground">Delete from Mazway only</span><span className="block text-[11px] text-muted mt-0.5">Keeps the original file in Google Drive.</span></span>
              </label>
            </fieldset>
            {driveNotConnected && <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">Google Drive is not connected. Reconnect Drive or choose Mazway only.</p>}
            {deleteCaptureError && <p role="alert" className="text-xs text-red-600 mb-3">{deleteCaptureError}</p>}
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => { setDeleteCaptureModalOpen(false); setDeleteOperationId(null); }}
                disabled={deletingCapture}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDeleteCapture}
                disabled={deletingCapture}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingCapture ? "Deleting..." : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SingleViewPage() {
  return (
    <Suspense fallback={<div className="h-screen bg-white" />}>
      <SingleViewContent />
    </Suspense>
  );
}
