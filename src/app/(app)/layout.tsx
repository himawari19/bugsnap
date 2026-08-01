"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: "📊" },
  { label: "All Captures", href: "/captures", icon: "📁" },
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
  const [session, setSession] = useState<{
    loading: boolean;
    user: null | { id: string; email: string; name: string; avatar: string };
  }>({ loading: true, user: null });

  // Auth guard: a Supabase session is required to view the dashboard.
  // The captures table is RLS-locked to the signed-in user, so without a
  // session the grid is always empty (the original "blank" symptom).
  useEffect(() => {
    // Read ?ws= from the URL without useSearchParams (avoids the
    // suspense-boundary requirement for prerendered layouts).
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      setWsParam(url.searchParams.get("ws"));
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const u = data.session?.user;
      if (!u) {
        router.replace("/");
        return;
      }
      const meta = u.user_metadata || {};
      setSession({
        loading: false,
        user: {
          id: u.id,
          email: u.email || "",
          name: meta.full_name || meta.name || u.email?.split("@")[0] || "User",
          avatar: meta.avatar_url || meta.picture || "",
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
        setActiveWsId((prev) => prev ?? initialWs);
      } catch (err) {
        console.warn("Failed to load workspaces:", err);
        // Degrade gracefully: the default "Personal Workspace" view (no
        // members) stays in place.
      }
    })();

    return () => {
      active = false;
    };
  }, [session.user?.id, wsParam]);

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
      router.replace(`?ws=${created.id}`, { scroll: false });
      setNewWsName("");
      setCreateWsModalOpen(false);
    } catch (err) {
      console.warn("Failed to create workspace:", err);
      setCreateWsError("Could not create workspace. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim();
    if (!email || !activeWsId || inviting) return;
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
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-60 border-r border-border bg-white shrink-0 flex flex-col">
        <div className="px-5 py-6 border-b border-border">
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Mazway
          </h1>
          <p className="text-sm text-muted mt-0.5">Screen Recorder</p>
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
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWsId(ws.id);
                      setWsOpen(false);
                      router.replace(`?ws=${ws.id}`, { scroll: false });
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors ${
                      activeWsId === ws.id ? "text-indigo-600 bg-indigo-50 font-medium" : "text-foreground hover:bg-subtle"
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-md text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                      activeWsId === ws.id ? "bg-indigo-600 text-white" : "bg-subtle text-muted"
                    }`}>
                      {ws.name.charAt(0)}
                    </span>
                    <span className="flex-1 truncate text-left">{ws.name}</span>
                    {activeWsId === ws.id && (
                      <svg className="w-4 h-4 text-indigo-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
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
                <span className="text-base">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
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
              <p className="font-medium text-foreground truncate">{currentUser.name}</p>
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
      <main className="flex-1 overflow-auto">{children}</main>

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
    </div>
  );
}
