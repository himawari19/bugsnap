"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Capture {
  id: string;
  title: string;
  type: string;
  drive_url: string;
  created_at: string;
  window_size?: string;
  workspace_id?: string | null;
  owner_email?: string | null;
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
  const clean = email.replace(/[^a-zA-Z0-9]/g, "").trim();
  const char = clean.charAt(0);
  return (char || "M").toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export default function DashboardAnalyticsPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-muted">Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const wsParam = searchParams.get("ws");
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<{ name: string; email: string }>({
    name: "User",
    email: "",
  });

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      if (u) {
        const meta = u.user_metadata || {};
        setSession({
          name: meta.full_name || meta.name || u.email?.split("@")[0] || "User",
          email: u.email || "",
        });
      }
    });

    (async () => {
      // Explicit column list (skip heavy dev_logs) — keeps the dashboard fast.
      let query = supabase
        .from("captures")
        .select("id, title, type, drive_url, created_at, window_size, workspace_id, owner_email, duration")
        .order("created_at", { ascending: false });
      // Filter server-side when a workspace is active. If the workspace_id
      // column hasn't been added to the DB yet (deploy race), the .eq is a
      // no-op and we fall back to the client-side filter below.
      if (wsParam && wsParam !== "all") {
        query = query.eq("workspace_id", wsParam);
      }
      const { data, error } = await query;
      if (error) {
        console.warn("Error fetching captures:", error);
      } else if (!cancelled) {
        setCaptures(data || []);
      }
      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [wsParam]);

  // Restrict to the active workspace when a ws param is present. The
  // undefined/null guards tolerate the workspace_id column not existing yet.
  const wsCaptures = captures.filter(
    (c) =>
      !wsParam ||
      wsParam === "all" ||
      c.workspace_id === undefined ||
      c.workspace_id === null ||
      c.workspace_id === wsParam
  );

  const videos = wsCaptures.filter((c) => c.type === "video");
  const screenshots = wsCaptures.filter((c) => c.type === "screenshot");

  // Storage usage estimate: screenshots avg 200KB, videos avg 4.5MB
  const storageUsageMb = (screenshots.length * 0.2) + (videos.length * 4.5);
  const storageUsageText = storageUsageMb > 1024 
    ? `${(storageUsageMb / 1024).toFixed(1)} GB`
    : `${storageUsageMb.toFixed(1)} MB`;

  // Contributors Leaderboard
  const contributorCounts: Record<string, number> = {};
  wsCaptures.forEach((c) => {
    const email = c.owner_email || "Anonymous";
    contributorCounts[email] = (contributorCounts[email] || 0) + 1;
  });
  const contributors = Object.entries(contributorCounts)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // This week's captures
  const now = Date.now();
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = wsCaptures.filter((c) => now - new Date(c.created_at).getTime() < weekMs);

  // Recent 5
  const recent = wsCaptures.slice(0, 5);

  // Group by day for a simple bar chart (last 7 days)
  const days: { label: string; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString("en-GB", { weekday: "short" });
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const count = wsCaptures.filter(
      (c) => new Date(c.created_at).getTime() >= dayStart && new Date(c.created_at).getTime() < dayEnd
    ).length;
    days.push({ label, count });
  }
  const maxDayCount = Math.max(1, ...days.map((d) => d.count));

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-white p-5 animate-pulse">
              <div className="w-1/2 h-3 bg-subtle rounded mb-3" />
              <div className="w-2/3 h-8 bg-subtle rounded" />
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl border border-border bg-white p-6 animate-pulse">
          <div className="w-1/3 h-4 bg-subtle rounded mb-6" />
          <div className="h-40 bg-subtle rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {session.name.split(" ")[0]} 👋
          </h1>
          <p className="text-sm text-muted mt-1">Here&apos;s what&apos;s happening with your captures.</p>
        </div>
        <Link
          href="/captures"
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          View All Captures
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {[
          {
            label: "Total Captures",
            value: wsCaptures.length,
            icon: (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            ),
            accent: "bg-indigo-50 text-indigo-600",
          },
          {
            label: "Recordings",
            value: videos.length,
            icon: (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ),
            accent: "bg-rose-50 text-rose-500",
          },
          {
            label: "Screenshots",
            value: screenshots.length,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            ),
            accent: "bg-emerald-50 text-emerald-600",
          },
          {
            label: "Storage Estimate",
            value: storageUsageText,
            icon: (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
            ),
            accent: "bg-amber-50 text-amber-600",
          },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted">{stat.label}</span>
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.accent}`}>
                {stat.icon}
              </span>
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Activity Chart */}
        <div className="lg:col-span-3 rounded-xl border border-border bg-white p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-base font-semibold text-foreground">Weekly Activity</h2>
            <span className="text-xs text-muted">Last 7 days</span>
          </div>
          <div className="flex items-end gap-3 h-40">
            {days.map((d) => (
              <div key={d.label} className="flex-1 flex flex-col items-center gap-2">
                <span className="text-[11px] text-muted font-medium">{d.count || ""}</span>
                <div
                  className="w-full max-w-[42px] rounded-t-lg bg-indigo-100 hover:bg-indigo-500 transition-colors relative group"
                  style={{ height: `${Math.max(4, (d.count / maxDayCount) * 120)}px` }}
                  title={`${d.count} captures`}
                />
                <span className="text-[11px] text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground">Recent Activity</h2>
            <Link href="/captures" className="text-xs text-indigo-600 font-medium hover:underline">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-xs text-muted">No captures yet.</p>
              <p className="text-[11px] text-muted mt-1">
                Use the mazwayScreen extension to create your first capture.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {recent.map((c) => (
                <Link
                  key={c.id}
                  href={`/v/${c.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-subtle transition-colors"
                >
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      c.type === "video" ? "bg-rose-50 text-rose-500" : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {c.type === "video" ? (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{c.title}</p>
                    <p className="text-[11px] text-muted">
                      {timeAgo(c.created_at)}
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Team Analytics — leaderboard by capture count (per workspace) */}
      {wsCaptures.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-white p-7">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/60">
            <h2 className="text-base font-semibold text-foreground">Team Activity</h2>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">All time</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Column 1: Capture Types */}
            <div className="pr-4 md:border-r border-border/70 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Capture Types
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted flex items-center gap-1.5">🎥 Videos</span>
                  <span className="font-semibold text-foreground bg-subtle px-2 py-0.5 rounded border border-border">{videos.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted flex items-center gap-1.5">📷 Screenshots</span>
                  <span className="font-semibold text-foreground bg-subtle px-2 py-0.5 rounded border border-border">{screenshots.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1.5 border-t border-dashed border-border/60">
                  <span className="font-medium text-foreground">Total Captures</span>
                  <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-100">{wsCaptures.length}</span>
                </div>
              </div>
            </div>

            {/* Column 2: Weekly Recap */}
            <div className="pr-4 md:border-r border-border/70 space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                This Week
              </p>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">New captures</span>
                  <span className="font-semibold text-foreground bg-subtle px-2 py-0.5 rounded border border-border">{thisWeek.length}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">Busiest day</span>
                  <span className="font-semibold text-foreground bg-subtle px-2 py-0.5 rounded border border-border">
                    {days.reduce((a, b) => (b.count > a.count ? b : a), days[0]).label}
                  </span>
                </div>
              </div>
            </div>

            {/* Column 3: Leaderboard */}
            <div className="space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Team Leaderboard
              </p>
              <div className="space-y-2.5 max-h-36 overflow-y-auto pr-1">
                {contributors.map((c) => (
                  <div key={c.email} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full ${getAvatarColor(c.email)} text-white text-[9px] font-bold flex items-center justify-center shrink-0`}>
                        {getOwnerInitial(c.email)}
                      </span>
                      <span className="text-foreground font-medium truncate" title={c.email}>
                        {c.email.split("@")[0]}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 shrink-0">
                      {c.count} caps
                    </span>
                  </div>
                ))}
                {contributors.length === 0 && (
                  <p className="text-xs text-muted">No contributors yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
