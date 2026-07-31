"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Recordings", href: "/dashboard/recordings", icon: "🎥" },
  { label: "Screenshots", href: "/dashboard/screenshots", icon: "📷" },
  { label: "Settings", href: "/dashboard/settings", icon: "⚙️" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

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
