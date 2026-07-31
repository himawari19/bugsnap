"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Recordings", href: "/dashboard/recordings", icon: "🎥" },
  { label: "Screenshots", href: "/dashboard/screenshots", icon: "📷" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

const workspaces = ["Personal Workspace", "Acme Design Team", "Acme QA"];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [wsOpen, setWsOpen] = useState(false);
  const [activeWs, setActiveWs] = useState(workspaces[0]);

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
              {activeWs.charAt(0)}
            </span>
            <span className="flex-1 truncate">{activeWs}</span>
            <svg className={`w-3.5 h-3.5 text-muted transition-transform ${wsOpen ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {wsOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setWsOpen(false)} />
              <div className="absolute left-3 right-3 top-full mt-1 z-50 rounded-lg border border-border bg-white shadow-lg py-1">
                {workspaces.map((ws) => (
                  <button
                    key={ws}
                    onClick={() => {
                      setActiveWs(ws);
                      setWsOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition-colors ${
                      activeWs === ws ? "text-indigo-600" : "text-foreground hover:bg-subtle"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded text-[10px] font-semibold flex items-center justify-center shrink-0 ${
                      activeWs === ws ? "bg-indigo-100 text-indigo-600" : "bg-subtle text-muted"
                    }`}>
                      {ws.charAt(0)}
                    </span>
                    <span className="flex-1 truncate">{ws}</span>
                    {activeWs === ws && (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </button>
                ))}
                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => setWsOpen(false)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-muted hover:bg-subtle hover:text-foreground transition-colors"
                  >
                    <span className="w-5 h-5 rounded border border-dashed border-muted/50 text-[12px] leading-none flex items-center justify-center shrink-0">
                      +
                    </span>
                    Create new workspace
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Invite Team */}
          <button className="mt-3 w-full flex items-center gap-2.5 px-3 py-2.5 text-sm font-medium rounded-lg border border-dashed border-border text-muted hover:text-foreground hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
            </svg>
            Invite Team
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard/recordings" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
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
        <div className="px-5 py-4 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold">
              U
            </div>
            <div className="text-sm">
              <p className="font-medium text-foreground">User</p>
              <p className="text-muted text-xs">user@example.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
