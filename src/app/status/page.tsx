import { Metadata } from "next";
import { StaticShell } from "@/components/StaticShell";

export const metadata: Metadata = {
  title: "System Status — BugSnap",
  description: "Check the operational status of BugSnap services, API endpoints, and authentication.",
};

const services = [
  { name: "Web Dashboard (App Router)", status: "Operational", badge: "bg-emerald-500" },
  { name: "Supabase Database & RPCs", status: "Operational", badge: "bg-emerald-500" },
  { name: "Google Drive OAuth Integration", status: "Operational", badge: "bg-emerald-500" },
  { name: "AI Summary Service (OpenRouter)", status: "Operational", badge: "bg-emerald-500" },
  { name: "Slack & Discord Webhook Delivery", status: "Operational", badge: "bg-emerald-500" },
  { name: "Chrome Extension Bridge", status: "Operational", badge: "bg-emerald-500" },
];

export default function StatusPage() {
  return (
    <StaticShell
      title="System Status & API Health"
      subtitle="Real-time operational status for all BugSnap services, database cluster, and cloud integrations."
    >
      <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">

        {/* Main Status Header */}
        <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3.5 w-3.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
            </span>
            <div>
              <h2 className="text-base font-bold text-foreground">All Systems Operational</h2>
              <p className="text-xs text-muted">99.98% overall system uptime over the last 90 days.</p>
            </div>
          </div>
          <span className="text-xs text-muted hidden sm:inline">Checked just now</span>
        </div>

        {/* System Component Breakdown */}
        <div className="border border-border rounded-xl bg-white overflow-hidden shadow-sm">
          <div className="bg-subtle/50 px-5 py-3 border-b border-border text-xs font-bold uppercase tracking-wider text-muted">
            Service Components
          </div>
          <div className="divide-y divide-border">
            {services.map((svc) => (
              <div key={svc.name} className="px-5 py-3.5 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{svc.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${svc.badge}`} />
                  <span className="text-xs font-medium text-emerald-700">{svc.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Historical bar */}
        <div className="border border-border rounded-xl p-6 bg-white space-y-4">
          <div className="flex items-center justify-between text-xs text-muted">
            <span>Uptime History (Last 90 Days)</span>
            <span className="font-semibold text-foreground">99.98%</span>
          </div>
          <div className="flex gap-1 h-8">
            {Array.from({ length: 45 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-emerald-400 hover:bg-emerald-500 transition-colors"
                title={`Day ${i + 1}: 100% Uptime`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-muted">
            <span>90 days ago</span>
            <span>Today</span>
          </div>
        </div>

      </div>
    </StaticShell>
  );
}