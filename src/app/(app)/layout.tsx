"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "All Captures", href: "/captures", icon: "▦" },
];

type Workspace = {
  id: string;
  name: string;
  slug?: string;
  owner_user_id: string | null;
  created_at: string;
  role: string;
  member_count: number;
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [wsParam, setWsParam] = useState<string | null>(null);
  const [wsOpen, setWsOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [promoBanner, setPromoBanner] = useState<{ enabled: boolean; message: string } | null>(null);
  const [promoDismissed, setPromoDismissed] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [createWsModalOpen, setCreateWsModalOpen] = useState(false);
  const [newWsName, setNewWsName] = useState("");
  const [createWsError, setCreateWsError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [members, setMembers] = useState<Record<string, string[]>>({});
  const [folders, setFolders] = useState<string[]>([]);
  const [createFolderModalOpen, setCreateFolderModalOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [createFolderError, setCreateFolderError] = useState<string | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  
  // Custom Rename & Delete Folder Modal states
  const [renameFolderModalOpen, setRenameFolderModalOpen] = useState(false);
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [renameFolderNameInput, setRenameFolderNameInput] = useState("");
  
  const [deleteFolderModalOpen, setDeleteFolderModalOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  // Custom Rename & Delete Workspace Modal states
  const [renameWsModalOpen, setRenameWsModalOpen] = useState(false);
  const [wsToRename, setWsToRename] = useState<string | null>(null);
  const [renameWsNameInput, setRenameWsNameInput] = useState("");

  const [deleteWsModalOpen, setDeleteWsModalOpen] = useState(false);
  const [wsToDelete, setWsToDelete] = useState<string | null>(null);
  const [deletingWs, setDeletingWs] = useState(false);

  const [session, setSession] = useState<{
    loading: boolean;
    user: null | { id: string; email: string; name: string; avatar: string; plan: "free" | "pro" };
    suspended?: boolean;
  }>({ loading: true, user: null });
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [newCommentCount, setNewCommentCount] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifLastSeen, setNotifLastSeen] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("mazway_notif_last_seen") || 0);
    } catch {
      return 0;
    }
  });

  // In-app notification: count comments on this user's captures posted
  // after last-seen (or within the last 7 days if never seen).
  useEffect(() => {
    const email = session.user?.email;
    if (!email) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const lastSeenMs = notifLastSeen || Date.now() - 7 * 24 * 60 * 60 * 1000;
        const since = new Date(lastSeenMs).toISOString();
        const { data: mine, error: capturesError } = await supabase
          .from("captures")
          .select("id")
          .eq("owner_email", email);
        if (capturesError) throw capturesError;
        const ids = (mine ?? []).map((r) => r.id);
        if (!ids.length) { if (!cancelled) setNewCommentCount(0); return; }
        const { count, error: commentsError } = await supabase
          .from("comments")
          .select("id", { count: "exact", head: true })
          .in("capture_id", ids)
          .gte("created_at", since);
        if (commentsError) throw commentsError;
        if (!cancelled) setNewCommentCount(count ?? 0);
      } catch (error) {
        console.warn("Failed to load notifications:", error);
      }
    };
    poll();
    const t = setInterval(poll, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [session.user?.email, notifLastSeen]);

  // Mark all notifications as read
  const handleClearNotifications = () => {
    const now = Date.now();
    setNotifLastSeen(now);
    setNewCommentCount(0);
    setNotifOpen(false);
    try {
      localStorage.setItem("mazway_notif_last_seen", String(now));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn("Failed to load session:", error);
        setSession({ loading: false, user: null });
        return;
      }
      const u = data.session?.user;
      if (!u) {
        setSession({ loading: false, user: null });
        router.replace("/");
        return;
      }
      const meta = u.user_metadata || {};
      const userEmail = u.email || "";
      
      // Read the plan from public.users (source of truth updated by the
      // Stripe webhook) so upgrades take effect immediately without re-login.
      let dbPlan: "free" | "pro" = (meta.plan || "free") as "free" | "pro";
      let suspended = false;
      if (userEmail) {
        const { data: userRow } = await supabase
          .from("users")
          .select("plan, suspended")
          .ilike("email", userEmail)
          .maybeSingle();
        if (userRow?.plan === "pro") dbPlan = "pro";
        if (userRow?.suspended) suspended = true;
      }

      // Block suspended users from the app shell.
      if (suspended) {
        setSession({ loading: false, user: null, suspended: true });
        return;
      }

      setSession({
        loading: false,
        user: {
          id: u.id,
          email: userEmail,
          name: meta.full_name || meta.name || userEmail?.split("@")[0] || "User",
          avatar: meta.avatar_url || meta.picture || "",
          plan: dbPlan,
        },
      });
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      if (!s) {
        router.replace("/");
      }
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  // Read ?ws= from the URL without useSearchParams (avoids the
  // suspense-boundary requirement for prerendered layouts).
  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      setWsParam(url.searchParams.get("ws"));
    }
  }, []);

  // Load the user's workspaces (owned or invited) via the RLS-safe RPC
  // once the session resolves. Falls back to the default single-workspace
  // view if the fetch fails so the sidebar never goes blank.
  useEffect(() => {
    let active = true;
    const uid = session.user?.id;
    if (!uid) return;

    (async () => {
      try {
        const { data: list, error: listErr } = await supabase.rpc(
          "get_my_workspaces"
        );
        if (listErr) throw listErr;
        let rows = (list ?? []) as Workspace[];

        // Preserve the default UX: every user gets a "Personal Workspace".
        // The create_workspace RPC fills slug/updated_at server-side.
        if (rows.length === 0) {
          const { error: createErr } = await supabase.rpc(
            "create_workspace",
            { p_name: "Personal Workspace" }
          );
          if (createErr) throw createErr;
          const { data: refetched, error: refetchErr } = await supabase.rpc(
            "get_my_workspaces"
          );
          if (refetchErr) throw refetchErr;
          rows = (refetched ?? []) as Workspace[];
          
          // Force set the URL and active state for this newly created workspace
          if (rows[0]?.id) {
            router.replace(`${pathname}?ws=${rows[0].id}`, { scroll: false });
          }
        }

        // Members per workspace (emails joined from auth.users via RPC).
        const memberMap: Record<string, string[]> = {};
        rows.forEach((w) => {
          memberMap[w.id] = [];
        });
        await Promise.all(
          rows.map(async (w) => {
            const { data: mem, error: memErr } = await supabase.rpc(
              "get_workspace_members",
              { p_workspace_id: w.id }
            );
            if (memErr) throw memErr;
            (mem ?? []).forEach((m: { user_id: string; email: string; role: string }) => {
              // Skip the owner — they're rendered separately as "Owner".
              if (m.role !== "owner" && m.email) {
                memberMap[w.id].push(m.email);
              }
            });
          })
        );

        if (!active) return;
        setWorkspaces(rows);
        setMembers(memberMap);
        // Initialize from the URL ?ws= param when valid, else first workspace.
        const initialWs =
          wsParam && rows.some((w) => w.id === wsParam)
            ? wsParam
            : rows[0]?.id ?? null;
        setActiveWsId(initialWs);
      } catch (err) {
        console.warn("Failed to load workspaces:", err);
        // Degrade gracefully: the default "Personal Workspace" view (no
        // members) stays in place.
      }
    })();

    return () => {
      active = false;
    };
  }, [session.user?.id, wsParam, router, pathname]);

  // Check if current user is a super admin
  useEffect(() => {
    if (!session.user?.id) return;
    let active = true;
    (async () => {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const token = authData.session?.access_token;
        if (!token) return;
        const res = await fetch("/api/admin/check", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (active && json.isAdmin) {
          setIsSuperAdmin(true);
        }
      } catch {
        // ignore — admin link simply won't show
      }
    })();
    return () => { active = false; };
  }, [session.user?.id]);

  // Fetch Promo Banner
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/promo");
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.promo && json.promo.enabled && json.promo.message) {
          const promoStr = json.promo.message;
          setPromoBanner(json.promo);
          // Check if user dismissed this exact message
          if (localStorage.getItem("mazway_promo_dismissed") === promoStr) {
            setPromoDismissed(true);
          }
        }
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  // Load the list of unique folders for the active workspace
  useEffect(() => {
    if (!activeWsId) return;
    let active = true;

    (async () => {
      try {
        // 1. Fetch folders that have captures
        const { data: capturesData, error: capturesErr } = await supabase
          .from("captures")
          .select("folder_name")
          .eq("workspace_id", activeWsId)
          .not("folder_name", "is", null);

        if (capturesErr) throw capturesErr;

        // 2. Fetch custom created folders in workspace
        const { data: customFoldersData, error: customFoldersErr } = await supabase
          .from("workspace_folders")
          .select("name")
          .eq("workspace_id", activeWsId);

        if (customFoldersErr) throw customFoldersErr;
        
        // Deduplicate folder names from both sources
        const allFolderNames = [
          ...(capturesData || []).map((c) => c.folder_name),
          ...(customFoldersData || []).map((f) => f.name)
        ].filter(Boolean) as string[];

        const uniqueFolders = Array.from(new Set(allFolderNames));

        if (active) {
          setFolders(uniqueFolders.sort());
        }
      } catch (err) {
        console.warn("Failed to load workspace folders:", err);
      }
    })();

    return () => {
      active = false;
    };
  }, [activeWsId]);

  if (session.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <svg className="w-7 h-7 text-muted animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          <p className="text-sm text-muted">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!session.user && session.suspended) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full bg-white border border-border rounded-xl p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          </div>
          <h1 className="text-lg font-bold text-foreground">Account Suspended</h1>
          <p className="text-sm text-muted mt-2 leading-relaxed">
            Your Mazway account has been suspended. If you believe this is a mistake, please contact your workspace administrator.
          </p>
        </div>
      </div>
    );
  }

  if (!session.user) {
    // router.replace("/") is in-flight; render nothing to avoid flicker.
    return null;
  }

  const currentUser = session.user;
  const activeWs = workspaces.find((w) => w.id === activeWsId) ?? null;
  const activeWsName = activeWs?.name ?? "Personal Workspace";
  const activeMembers = members[activeWs?.id ?? ""] ?? [];

  const initials = (currentUser.name || currentUser.email || "U")
    .trim()
    .charAt(0)
    .toUpperCase();

  const handleCreateFolder = async (name: string) => {
    if (!name || !activeWsId || creatingFolder) return;
    setCreatingFolder(true);
    setCreateFolderError(null);
    try {
      const { error } = await supabase
        .from("workspace_folders")
        .insert({ workspace_id: activeWsId, name: name.trim() });
      if (error) throw error;
      setFolders((prev) => Array.from(new Set([...prev, name.trim()])).sort());
      setNewFolderName("");
      setCreateFolderModalOpen(false);
    } catch (err) {
      console.warn("Failed to create folder:", err);
      setCreateFolderError("Could not create folder. Maybe it already exists?");
    } finally {
      setCreatingFolder(false);
    }
  };

  const handleRenameFolder = (currentName: string) => {
    setFolderToRename(currentName);
    setRenameFolderNameInput(currentName);
    setRenameFolderModalOpen(true);
  };

  const submitRenameFolder = async () => {
    if (!activeWsId || !folderToRename) return;
    const newName = renameFolderNameInput.trim();
    if (!newName || newName === folderToRename) {
      setRenameFolderModalOpen(false);
      return;
    }

    try {
      // 1. Update folder name in workspace_folders table
      const { error: folderErr } = await supabase
        .from("workspace_folders")
        .update({ name: newName })
        .eq("workspace_id", activeWsId)
        .eq("name", folderToRename);
      if (folderErr) throw folderErr;

      // 2. Update captures table records matching this folder
      const { error: capErr } = await supabase
        .from("captures")
        .update({ folder_name: newName })
        .eq("workspace_id", activeWsId)
        .eq("folder_name", folderToRename);
      if (capErr) throw capErr;

      // 3. Update local state
      setFolders((prev) =>
        prev.map((f) => (f === folderToRename ? newName : f)).sort()
      );
      
      // Redirect if current folder was active
      const url = new URL(window.location.href);
      if (url.searchParams.get("folder") === folderToRename) {
        router.replace(`/captures?ws=${activeWsId}&folder=${encodeURIComponent(newName)}`, { scroll: false });
      }
      setRenameFolderModalOpen(false);
    } catch (err) {
      console.warn("Failed to rename folder:", err);
      alert("Could not rename folder. Check connection.");
    }
  };

  const handleDeleteFolder = (folderName: string) => {
    setFolderToDelete(folderName);
    setDeleteFolderModalOpen(true);
  };

  const submitDeleteFolder = async () => {
    if (!activeWsId || !folderToDelete || deletingFolder) return;
    setDeletingFolder(true);

    try {
      // Call postgres RPC to drop folder + captures, and add to deleted_drive_folders queue
      const { error } = await supabase.rpc("delete_workspace_folder", {
        p_workspace_id: activeWsId,
        p_folder_name: folderToDelete,
      });
      if (error) throw error;

      // Update local state
      setFolders((prev) => prev.filter((f) => f !== folderToDelete));
      
      // Redirect to main captures if current folder was active
      const url = new URL(window.location.href);
      if (url.searchParams.get("folder") === folderToDelete) {
        router.replace(`/captures?ws=${activeWsId}`, { scroll: false });
      }
      
      setDeleteFolderModalOpen(false);
      alert(`Folder "${folderToDelete}" queued for deletion on Google Drive.`);
    } catch (err) {
      console.warn("Failed to delete folder:", err);
      alert("Could not delete folder. Please try again.");
    } finally {
      setDeletingFolder(false);
    }
  };

  const handleCreateWorkspace = async (name: string) => {
    if (!name || creating) return;
    setCreating(true);
    setCreateWsError(null);
    try {
      // RPC returns the new workspace UUID directly.
      const { data: newWsId, error: wsErr } = await supabase.rpc(
        "create_workspace",
        { p_name: name }
      );
      if (wsErr) throw wsErr;
      const created = {
        id: String(newWsId),
        name,
        slug: undefined,
        owner_user_id: currentUser.id,
        created_at: new Date().toISOString(),
        role: "owner",
        member_count: 1,
      };
      setWorkspaces((prev) => [...prev, created]);
      setMembers((prev) => ({ ...prev, [created.id]: [] }));
      setActiveWsId(created.id);
      router.replace(`${pathname}?ws=${created.id}`, { scroll: false });
      setNewWsName("");
      setCreateWsModalOpen(false);
    } catch (err) {
      console.warn("Failed to create workspace:", err);
      setCreateWsError("Could not create workspace. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleRenameWorkspace = (id: string, currentName: string) => {
    setWsToRename(id);
    setRenameWsNameInput(currentName);
    setRenameWsModalOpen(true);
  };

  const submitRenameWorkspace = async () => {
    if (!wsToRename) return;
    const newName = renameWsNameInput.trim();
    if (!newName || newName === (workspaces.find(w => w.id === wsToRename)?.name || "")) {
      setRenameWsModalOpen(false);
      return;
    }
    try {
      const { error } = await supabase
        .from("workspaces")
        .update({ name: newName })
        .eq("id", wsToRename);
      if (error) throw error;
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === wsToRename ? { ...w, name: newName } : w))
      );
      setRenameWsModalOpen(false);
    } catch (err) {
      console.warn("Failed to rename workspace:", err);
      alert("Could not rename workspace.");
    }
  };

  const handleDeleteWorkspace = (id: string) => {
    if (workspaces.length <= 1) {
      alert("You must keep at least one workspace.");
      return;
    }
    setWsToDelete(id);
    setDeleteWsModalOpen(true);
  };

  const submitDeleteWorkspace = async () => {
    if (!wsToDelete || deletingWs) return;
    setDeletingWs(true);
    try {
      const { error } = await supabase.from("workspaces").delete().eq("id", wsToDelete);
      if (error) throw error;
      const remaining = workspaces.filter((w) => w.id !== wsToDelete);
      setWorkspaces(remaining);
      const nextActiveId = remaining[0]?.id || null;
      setActiveWsId(nextActiveId);
      if (nextActiveId) {
        router.replace(`${pathname}?ws=${nextActiveId}`, { scroll: false });
      } else {
        router.replace(pathname, { scroll: false });
      }
      setDeleteWsModalOpen(false);
    } catch (err) {
      console.warn("Failed to delete workspace:", err);
      alert("Could not delete workspace.");
    } finally {
      setDeletingWs(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !activeWsId || inviting) return;

    // SaaS Seats Limit: Max 5 members on Free tier
    if (currentUser.plan === "free" && activeMembers.length >= 4) {
      setInviteError("Free workspaces are limited to 5 members. Upgrade to Pro for unlimited seats.");
      return;
    }

    setInviting(true);
    setInviteError(null);
    try {
      const { error } = await supabase.rpc("invite_member_by_email", {
        p_workspace_id: activeWsId,
        p_email: email,
      });
      if (error) throw error;
      setMembers((prev) => ({
        ...prev,
        [activeWsId]: [...(prev[activeWsId] || []), email],
      }));
      setInviteEmail("");
      setInviteModalOpen(false);
    } catch (err) {
      console.warn("Failed to invite member:", err);
      // invite_member_by_email raises a clear message e.g. "No user found
      // with that email..." — surface that to the user. Real email delivery
      // (sending an actual invite mail) is a future task.
      setInviteError(
        (err as { message?: string })?.message ||
          "Could not send invite. Please try again."
      );
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {promoBanner && promoBanner.enabled && promoBanner.message && !promoDismissed && (
        <div className="shrink-0 bg-indigo-600 text-white px-4 py-2.5 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0 text-sm font-medium leading-snug text-center">
            {promoBanner.message}
          </div>
          <button
            type="button"
            aria-label="Dismiss promo"
            onClick={() => {
              try { localStorage.setItem("mazway_promo_dismissed", promoBanner.message); } catch {}
              setPromoDismissed(true);
            }}
            className="shrink-0 text-white/80 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>
      )}
    <div className="flex flex-1 min-h-0 bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-white shrink-0 flex flex-col h-full overflow-visible">
        <div className="px-5 py-5 border-b border-border flex items-center gap-2.5">
          <svg viewBox="0 0 128 128" className="w-7 h-7 shrink-0" role="img" aria-label="Mazway">
            <rect x="8" y="8" width="112" height="112" rx="27" fill="url(#sidebar-lg)" />
            <defs>
              <linearGradient id="sidebar-lg" x1="14" y1="12" x2="114" y2="118" gradientUnits="userSpaceOnUse">
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
          <div>
            <h1 className="text-sm font-bold tracking-tight text-foreground leading-none">
              Mazway
            </h1>
            <p className="text-[10px] text-muted mt-1 leading-none font-medium">Screen Recorder</p>
          </div>

          {/* Notification Bell */}
          <div className="relative ml-auto">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className="relative p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-subtle transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {newCommentCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {newCommentCount > 99 ? "99+" : newCommentCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <>
                {/* Click-catcher that closes the dropdown without blocking page scroll */}
                <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} onWheel={() => setNotifOpen(false)} />
                <div className="fixed left-4 top-16 z-50 w-64 rounded-xl border border-border bg-white shadow-xl py-2 px-1">
                  <div className="flex items-center justify-between px-3 py-1 mb-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Notifications</p>
                    {newCommentCount > 0 && (
                      <button
                        onClick={handleClearNotifications}
                        className="text-[10px] font-semibold text-indigo-600 hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                  {newCommentCount > 0 ? (
                    <div
                      className="px-3 py-2 text-xs text-foreground cursor-pointer hover:bg-subtle rounded-lg transition-colors"
                      onClick={() => {
                        handleClearNotifications();
                        router.push("/captures");
                      }}
                    >
                      <p className="font-medium">💬 {newCommentCount} new comment{newCommentCount > 1 ? "s" : ""} on your captures</p>
                    </div>
                  ) : (
                    <div className="px-3 py-4 text-center">
                      <p className="text-xs text-muted/60">No new notifications</p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="px-3 pt-4 relative">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Workspace
          </p>
          <button
            onClick={() => setWsOpen((o) => !o)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg border border-border bg-white hover:bg-subtle transition-colors text-left"
          >
            <span className="w-6 h-6 rounded-md bg-indigo-600 text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
              {activeWsName.charAt(0)}
            </span>
            <span className="flex-1 truncate">{activeWsName}</span>
            <svg className={`w-3.5 h-3.5 text-muted transition-transform ${wsOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {wsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
              <div className="absolute left-3 right-3 top-[calc(100%+4px)] z-50 rounded-xl border border-border bg-white shadow-xl py-2 px-1">
                <div className="px-3 py-1 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Workspaces</p>
                </div>
                {workspaces.map((ws) => (
                  <div
                    key={ws.id}
                    className={`w-full flex items-center justify-between gap-1 px-1 rounded-lg group/item transition-colors ${
                      activeWsId === ws.id ? "bg-indigo-50 font-medium" : "hover:bg-subtle"
                    }`}
                  >
                    <button
                      onClick={() => {
                        setActiveWsId(ws.id);
                        setWsOpen(false);
                        router.replace(`?ws=${ws.id}`, { scroll: false });
                      }}
                      className={`flex-1 flex items-center gap-3 px-2 py-2 text-sm text-left truncate ${
                        activeWsId === ws.id ? "text-indigo-600 font-medium" : "text-foreground"
                      }`}
                    >
                      <span className={`w-6 h-6 rounded-md text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                        activeWsId === ws.id ? "bg-indigo-600 text-white" : "bg-subtle text-muted"
                      }`}>
                        {ws.name.charAt(0)}
                      </span>
                      <span className="truncate flex-1">{ws.name}</span>
                      {activeWsId === ws.id && (
                        <svg className="w-4 h-4 text-indigo-600 shrink-0 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>
                    
                    {/* Workspace Actions (Rename & Delete) — visible only for owners */}
                    {ws.role === "owner" && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity shrink-0 pr-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRenameWorkspace(ws.id, ws.name);
                          }}
                          title="Rename Workspace"
                          className="p-1 rounded text-muted hover:text-foreground hover:bg-neutral-200/50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkspace(ws.id);
                          }}
                          title="Delete Workspace"
                          className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Workspace Members list */}
                <div className="border-t border-border mt-2 pt-2 px-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Members ({1 + activeMembers.length})
                    </span>
                    <button
                      onClick={() => {
                        setWsOpen(false);
                        setInviteModalOpen(true);
                      }}
                      className="text-[10px] font-semibold text-indigo-600 hover:underline"
                    >
                      + Invite
                    </button>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {/* Owner */}
                    <div className="flex items-center gap-2 py-1 text-xs text-foreground">
                      <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                        {initials}
                      </span>
                      <span className="truncate flex-1 font-medium">{currentUser.name}</span>
                      <span className="text-[9px] font-semibold text-muted bg-subtle px-1 py-0.5 rounded">Owner</span>
                    </div>
                    {/* Invited members */}
                    {activeMembers.map((m) => (
                      <div key={m} className="flex items-center gap-2 py-1 text-xs text-foreground">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[9px] font-bold flex items-center justify-center shrink-0">
                          {m.charAt(0).toUpperCase()}
                        </span>
                        <span className="truncate flex-1 text-muted">{m}</span>
                        <span className="text-[9px] font-semibold text-emerald-600 bg-emerald-50 px-1 py-0.5 rounded">Member</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t border-border mt-2 pt-1">
                  <button
                    onClick={() => {
                      setWsOpen(false);
                      setCreateWsModalOpen(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-muted hover:bg-subtle hover:text-foreground transition-colors group"
                  >
                    <span className="w-5 h-5 rounded border border-dashed border-muted/40 text-muted group-hover:border-indigo-400 group-hover:text-indigo-600 text-xs leading-none flex items-center justify-center shrink-0">
                      +
                    </span>
                    Create new workspace
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
            // Preserve the active workspace across navigation so the
            // captures/dashboard filters keep applying.
            const href = activeWsId ? `${item.href}?ws=${activeWsId}` : item.href;
            return (
              <Link
                key={item.href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                  active
                    ? "bg-subtle text-foreground"
                    : "text-muted hover:text-foreground hover:bg-subtle"
                }`}
              >
                <span className="text-base" aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {isSuperAdmin && (
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                pathname === "/admin" ? "bg-subtle text-foreground" : "text-muted hover:text-foreground hover:bg-subtle"
              }`}
            >
              <span className="text-base" aria-hidden="true">🛡️</span>
              Super Admin
            </Link>
          )}

          {/* Google Drive Folders List (Sync Bridge) */}
          <div className="pt-4 space-y-1">
            <div className="flex items-center justify-between px-3 pb-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
                </svg>
                Folders
              </p>
              <button
                onClick={() => setCreateFolderModalOpen(true)}
                className="text-[10px] font-bold text-indigo-600 hover:underline"
              >
                + Create
              </button>
            </div>
            
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {folders.map((folder) => {
                const isActiveFolder = typeof window !== "undefined" && new URL(window.location.href).searchParams.get("folder") === folder;
                const activeWsRole = workspaces.find(w => w.id === activeWsId)?.role;
                return (
                  <div
                    key={folder}
                    className={`w-full flex items-center justify-between gap-1 px-1 rounded-lg group/folder transition-colors ${
                      isActiveFolder ? "bg-indigo-50 font-semibold" : "hover:bg-subtle"
                    }`}
                  >
                    <Link
                      href={`/captures?ws=${activeWsId}&folder=${encodeURIComponent(folder)}`}
                      className={`flex-1 flex items-center gap-2.5 px-2 py-1.5 text-xs truncate ${
                        isActiveFolder ? "text-indigo-600 font-semibold" : "text-muted hover:text-foreground"
                      }`}
                    >
                      <span className="text-xs shrink-0">📁</span>
                      <span className="truncate">{folder}</span>
                    </Link>

                    {/* Folder Actions (Rename & Delete) — visible only for owners */}
                    {activeWsRole === "owner" && (
                      <div className="flex items-center gap-0.5 opacity-0 group-hover/folder:opacity-100 transition-opacity shrink-0 pr-1">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleRenameFolder(folder);
                          }}
                          title="Rename Folder"
                          className="p-1 rounded text-muted hover:text-foreground hover:bg-neutral-200/50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteFolder(folder);
                          }}
                          title="Delete Folder"
                          className="p-1 rounded text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              
              {folders.length === 0 && (
                <div className="px-3 py-2 text-center rounded-lg border border-dashed border-border/80 mx-1 bg-subtle/30">
                  <p className="text-[10px] text-muted">No folders yet.</p>
                  <button
                    onClick={() => setCreateFolderModalOpen(true)}
                    className="text-[10px] font-semibold text-indigo-600 hover:underline mt-1"
                  >
                    Create a folder
                  </button>
                </div>
              )}
            </div>
          </div>
        </nav>

        {/* SaaS Upgrade CTA (Free tier only) */}
        {currentUser.plan !== "pro" && (
          <div className="px-4 py-3 mx-3 mb-3 bg-indigo-50 border border-indigo-100 rounded-xl">
            <h5 className="text-[11px] font-bold text-indigo-900 tracking-wide uppercase">Upgrade to Pro</h5>
            <p className="text-[10px] text-indigo-700 leading-tight mt-1 mb-2.5">Unlock E2EE, IP Whitelist, seats limits, and E2E security.</p>
            <button
              onClick={() => setBillingModalOpen(true)}
              className="w-full py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors text-center block"
            >
              Upgrade Now
            </button>
          </div>
        )}

        <div className="relative px-3 py-4 border-t border-border">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-subtle transition-colors text-left"
          >
            {currentUser.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentUser.avatar} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
            )}
            <div className="text-sm min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="font-medium text-foreground truncate">{currentUser.name}</p>
                {currentUser.plan === "pro" && (
                  <span className="bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0 rounded inline-flex items-center justify-center leading-none h-[15px] shrink-0 uppercase tracking-wide">
                    PRO
                  </span>
                )}
              </div>
              <p className="text-muted text-xs truncate">{currentUser.email}</p>
            </div>
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute bottom-full left-3 right-3 mb-1 z-50 rounded-lg border border-border bg-white shadow-lg py-1">
                <Link
                  href="/settings"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-subtle transition-colors"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Settings
                </Link>
                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    router.replace("/");
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 h-full overflow-y-auto">{children}</main>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setInviteModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Invite to Workspace</h2>
            <p className="text-sm text-muted mb-5">
              Add members to <span className="font-semibold text-foreground">{activeWsName}</span> so they can view and collaborate on captures.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="w-full text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
                  autoFocus
                />
              </div>
              {inviteError && (
                <p className="text-xs text-red-600">{inviteError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setInviteModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={!inviteEmail.trim() || inviting}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Send Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Workspace Modal */}
      {createWsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateWsModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Create Workspace</h2>
            <p className="text-sm text-muted mb-5">
              Workspaces let you organize captures and members separately &mdash; e.g. by team or project.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                placeholder="e.g. QA Team"
                className="w-full text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newWsName.trim()) {
                    handleCreateWorkspace(newWsName.trim());
                  }
                }}
              />
              {createWsError && (
                <p className="text-xs text-red-600 mt-1.5">{createWsError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setCreateWsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const name = newWsName.trim();
                  if (name) handleCreateWorkspace(name);
                }}
                disabled={!newWsName.trim() || creating}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Create Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billing / Upgrade Modal */}
      {billingModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setBillingModalOpen(false)} />
          <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl border border-border p-6 text-center">
            <h2 className="text-xl font-bold text-foreground mb-1">Upgrade to Mazway Pro</h2>
            <p className="text-sm text-muted mb-6">
              Get advanced security, unrestricted teams, and premium developer capabilities.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-4 rounded-xl border border-border bg-subtle text-left">
                <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Free Plan</span>
                <p className="text-2xl font-extrabold text-foreground mt-1">$0</p>
                <ul className="text-[11px] text-muted space-y-1.5 mt-3">
                  <li>• Max 5 team members</li>
                  <li>• Basic share links</li>
                  <li>• Basic analytics</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl border-2 border-indigo-500 bg-indigo-50/40 text-left relative overflow-hidden">
                <span className="absolute top-1.5 right-1.5 bg-indigo-600 text-white text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded">Popular</span>
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Pro Plan</span>
                <p className="text-2xl font-extrabold text-foreground mt-1">$15<span className="text-xs font-normal text-muted">/mo</span></p>
                <ul className="text-[11px] text-indigo-950 space-y-1.5 mt-3">
                  <li>• Unlimited members</li>
                  <li>• E2EE log protection</li>
                  <li>• IP & Domain whitelist</li>
                  <li>• Burn-after-reading</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setBillingModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    // Update user metadata in Supabase auth to simulate payment success
                    const { error } = await supabase.auth.updateUser({
                      data: { plan: "pro" }
                    });
                    if (error) throw error;
                    setBillingModalOpen(false);
                    // Reload window to re-fetch session with metadata
                    window.location.reload();
                  } catch (err) {
                    console.warn("Upgrade error:", err);
                    alert("Could not complete mock checkout.");
                  }
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Simulate Payment & Upgrade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Folder Modal */}
      {createFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCreateFolderModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Create Folder</h2>
            <p className="text-sm text-muted mb-5">
              Folders are synced with your Google Drive. Captures uploaded to this folder will be organized physically under this name in your Drive.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="e.g. Eyden - Quaker"
                className="w-full text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newFolderName.trim()) {
                    handleCreateFolder(newFolderName.trim());
                  }
                }}
              />
              {createFolderError && (
                <p className="text-xs text-red-600 mt-1.5">{createFolderError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setCreateFolderModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateFolder(newFolderName.trim())}
                disabled={!newFolderName.trim() || creatingFolder}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {creatingFolder ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {renameFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRenameFolderModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Rename Folder</h2>
            <p className="text-sm text-muted mb-5">
              Enter a new name for this folder. The change will sync to Google Drive.
            </p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">New Folder Name</label>
              <input
                type="text"
                value={renameFolderNameInput}
                onChange={(e) => setRenameFolderNameInput(e.target.value)}
                placeholder="e.g. Eyden - Quaker"
                className="w-full text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameFolderNameInput.trim()) {
                    submitRenameFolder();
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setRenameFolderModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRenameFolder}
                disabled={!renameFolderNameInput.trim() || renameFolderNameInput.trim() === folderToRename}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Folder Modal (Jira Style Popup Confirmation) */}
      {deleteFolderModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteFolderModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Delete Folder?</h2>
            <p className="text-xs text-muted leading-relaxed mb-6">
              Are you sure you want to delete <span className="font-semibold text-foreground">&quot;{folderToDelete}&quot;</span>?<br/>
              <span className="text-red-600 font-medium">WARNING:</span> All captures inside this folder will be permanently deleted from this dashboard and Google Drive.
            </p>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setDeleteFolderModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDeleteFolder}
                disabled={deletingFolder}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingFolder ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Workspace Modal */}
      {renameWsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRenameWsModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6">
            <h2 className="text-lg font-bold text-foreground mb-1">Rename Workspace</h2>
            <p className="text-sm text-muted mb-5">Enter a new name for this workspace.</p>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-muted mb-1.5">Workspace Name</label>
              <input
                type="text"
                value={renameWsNameInput}
                onChange={(e) => setRenameWsNameInput(e.target.value)}
                placeholder="e.g. QA Team"
                className="w-full text-sm rounded-lg border border-border px-3 py-2.5 outline-none focus:border-indigo-500 bg-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renameWsNameInput.trim()) {
                    submitRenameWorkspace();
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                onClick={() => setRenameWsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitRenameWorkspace}
                disabled={!renameWsNameInput.trim()}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Workspace Modal (Jira Style Popup Confirmation) */}
      {deleteWsModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteWsModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl bg-white shadow-xl border border-border p-6 text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-foreground mb-2">Delete Workspace?</h2>
            <p className="text-xs text-muted leading-relaxed mb-6">
              Are you sure you want to delete this workspace?<br/>
              <span className="text-red-600 font-medium">WARNING:</span> All its members and captures will be permanently deleted.
            </p>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
              <button
                onClick={() => setDeleteWsModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitDeleteWorkspace}
                disabled={deletingWs}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deletingWs ? "Deleting..." : "Delete Workspace"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
