"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalCaptures: number;
  totalViews: number;
  totalComments: number;
}

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  plan: string | null;
  created_at: string;
  workspace_count: number;
  capture_count: number;
  suspended?: boolean;
}

interface TopWorkspace {
  id: string;
  name: string;
  owner_email: string;
  capture_count: number;
}

interface Promo {
  enabled: boolean;
  message: string;
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ stats: AdminStats; users: AdminUser[]; topWorkspaces: TopWorkspace[]; promo: Promo } | null>(null);
  const [search, setSearch] = useState("");

  // Promo Banner state
  const [promoMessage, setPromoMessage] = useState("");
  const [promoEnabled, setPromoEnabled] = useState(false);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoSaved, setPromoSaved] = useState(false);

  // Broadcast Email state
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastBody, setBroadcastBody] = useState("");
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastResult, setBroadcastResult] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: authData } = await supabase.auth.getSession();
        const token = authData.session?.access_token;
        if (!token) throw new Error("Not logged in");

        const res = await fetch("/api/admin/data", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.status === 403) {
          throw new Error("Access restricted: You do not have super admin privileges.");
        }

        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to load admin data");

        if (!cancelled) {
          setData(json);
          setPromoMessage(json.promo?.message || "");
          setPromoEnabled(!!json.promo?.enabled);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  const [actingUserId, setActingUserId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggleSuspend(userId: string, suspended: boolean) {
    setActingUserId(userId);
    setActionError(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/admin/toggle-suspend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ user_id: userId, suspended }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update user");

      // Update local state for instant UI feedback
      setData((prev) => prev ? { ...prev, users: prev.users.map((u) => u.id === userId ? { ...u, suspended } : u) } : prev);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setActingUserId(null);
    }
  }

  async function savePromo() {
    setSavingPromo(true);
    setPromoSaved(false);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/admin/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: promoMessage, enabled: promoEnabled }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save promo banner");
      setPromoSaved(true);
      setTimeout(() => setPromoSaved(false), 3000);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to save promo banner");
    } finally {
      setSavingPromo(false);
    }
  }

  async function sendBroadcast() {
    if (!data) return;
    const confirmed = window.confirm(`Send this email to all ${data.stats.totalUsers} registered users? This cannot be undone.`);
    if (!confirmed) return;

    setSendingBroadcast(true);
    setBroadcastResult(null);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const token = authData.session?.access_token;
      if (!token) throw new Error("Not logged in");

      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: broadcastSubject, html: broadcastBody.replace(/\n/g, "<br>") }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to send broadcast");
      setBroadcastResult(`Successfully sent to ${json.sentCount} user(s).`);
      setBroadcastSubject("");
      setBroadcastBody("");
    } catch (err: unknown) {
      setBroadcastResult(err instanceof Error ? err.message : "Failed to send broadcast");
    } finally {
      setSendingBroadcast(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div>
          <div className="h-6 w-48 bg-subtle rounded mb-2" />
          <div className="h-4 w-96 bg-subtle rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-subtle rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="bg-red-50 text-red-600 border border-red-200 p-6 rounded-xl text-center">
          <svg className="w-10 h-10 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="text-lg font-bold">Access Denied</h2>
          <p className="mt-1 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const filteredUsers = data.users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.full_name || "").toLowerCase().includes(q)
    );
  });

  return (
    <main className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Super Admin</h1>
        <p className="text-sm text-muted mt-1">Platform overview and user management.</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Total Users", value: data.stats.totalUsers },
          { label: "Workspaces", value: data.stats.totalWorkspaces },
          { label: "Captures", value: data.stats.totalCaptures },
          { label: "Total Views", value: data.stats.totalViews },
          { label: "Comments", value: data.stats.totalComments },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-border rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-1">{s.label}</p>
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PROMO BANNER */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Global Promo Banner</h2>
            <p className="text-[11px] text-muted mt-0.5">Show an announcement to all users.</p>
          </div>
          <div>
            <textarea
              value={promoMessage}
              onChange={(e) => setPromoMessage(e.target.value)}
              placeholder="e.g. 🚀 50% Off PRO Plan this week! Code: MAZWAY50"
              className="w-full text-xs rounded-lg border border-border p-3 outline-none focus:border-indigo-500 resize-none h-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={promoEnabled}
                onChange={(e) => setPromoEnabled(e.target.checked)}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
              />
              Enable Banner
            </label>
            <button
              onClick={savePromo}
              disabled={savingPromo}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {savingPromo ? "Saving..." : promoSaved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>

        {/* EMAIL BROADCAST */}
        <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-foreground">Email Broadcast</h2>
            <p className="text-[11px] text-muted mt-0.5">Send a message to {data.stats.totalUsers} registered users.</p>
          </div>
          <div className="space-y-2">
            <input
              type="text"
              placeholder="Subject"
              value={broadcastSubject}
              onChange={(e) => setBroadcastSubject(e.target.value)}
              className="w-full text-xs rounded-lg border border-border px-3 py-2 outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Email body (HTML supported)..."
              value={broadcastBody}
              onChange={(e) => setBroadcastBody(e.target.value)}
              className="w-full text-xs rounded-lg border border-border p-3 outline-none focus:border-indigo-500 resize-none h-20"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="text-[10px] text-indigo-600 font-semibold max-w-[150px] truncate">
              {broadcastResult || ""}
            </div>
            <button
              onClick={sendBroadcast}
              disabled={sendingBroadcast || !broadcastSubject || !broadcastBody}
              className="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {sendingBroadcast ? "Sending..." : "Send Email"}
            </button>
          </div>
        </div>

        {/* TOP WORKSPACES */}
        <div className="bg-white border border-border rounded-xl p-0 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-border bg-subtle/30">
            <h2 className="text-sm font-bold text-foreground">Top Workspaces</h2>
            <p className="text-[11px] text-muted mt-0.5">By total capture count.</p>
          </div>
          <ul className="divide-y divide-border/50 flex-1 overflow-y-auto">
            {data.topWorkspaces.map((w) => (
              <li key={w.id} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{w.name}</div>
                  <div className="text-[10px] text-muted truncate">{w.owner_email}</div>
                </div>
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  <span className="text-xs font-bold text-indigo-600">{w.capture_count}</span>
                  <span className="text-[10px] text-muted">captures</span>
                </div>
              </li>
            ))}
            {data.topWorkspaces.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-muted">No workspaces yet.</li>
            )}
          </ul>
        </div>
      </div>

      {actionError && (
        <div className="bg-red-50 text-red-600 border border-red-200 rounded-xl p-3 text-sm">
          {actionError}
        </div>
      )}

      {/* USERS TABLE */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between bg-subtle/30">
          <h2 className="text-sm font-semibold text-foreground">Registered Users</h2>
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border outline-none focus:border-indigo-500 w-64"
            />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-subtle/50 text-[11px] uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Joined</th>
                <th className="px-4 py-3 font-semibold text-right">Workspaces</th>
                <th className="px-4 py-3 font-semibold text-right">Captures</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted text-sm">
                    No users found matching &quot;{search}&quot;.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-subtle/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{user.email}</div>
                      {user.full_name && <div className="text-[11px] text-muted">{user.full_name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        user.plan === 'pro' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-subtle text-muted border-border'
                      }`}>
                        {(user.plan || "free").toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        user.suspended ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}>
                        {user.suspended ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{user.workspace_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{user.capture_count}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={actingUserId === user.id}
                        onClick={() => toggleSuspend(user.id, !user.suspended)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors disabled:opacity-50 ${
                          user.suspended
                            ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
                            : 'text-red-600 border-red-200 bg-white hover:bg-red-50'
                        }`}
                      >
                        {actingUserId === user.id ? 'Updating...' : (user.suspended ? 'Activate' : 'Suspend')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
