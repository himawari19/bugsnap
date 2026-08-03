"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [brandName, setBrandName] = useState("mazway");
  const [logoUrl, setLogoUrl] = useState("");
  const [hideWatermark, setHideWatermark] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the active workspace id from the ?ws= URL param (same pattern as
  // the dashboard layout), falling back to null when absent.
  const [activeWsId, setActiveWsId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setActiveWsId(new URL(window.location.href).searchParams.get("ws"));
    }
  }, []);

  useEffect(() => {
    // Load workspace settings
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;

      if (u.user_metadata?.plan) {
        setUserPlan(u.user_metadata.plan as "free" | "pro");
      }

      if (activeWsId) {
        supabase
          .from("workspace_settings")
          .select("*")
          .eq("workspace_id", activeWsId)
          .maybeSingle()
          .then(({ data: row }) => {
            if (!row) return; // fall back to default state
            setWebhookUrl(row.webhook_url || "");
            setBrandName(row.brand_name || "mazway");
            setLogoUrl(row.custom_logo_url || "");
            setHideWatermark(!!row.hide_watermark);
            setCustomDomain(row.custom_domain || "");
          });
      }
    });
  }, [activeWsId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      if (!activeWsId) {
        throw new Error("No active workspace selected. Please pick a workspace and try again.");
      }
      const { error } = await supabase.from("workspace_settings").upsert({
        workspace_id: activeWsId,
        webhook_url: webhookUrl.trim(),
        brand_name: brandName.trim() || "mazway",
        custom_logo_url: logoUrl.trim(),
        hide_watermark: hideWatermark,
        custom_domain: customDomain.trim(),
      });
      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save settings";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Workspace Settings</h1>
        <p className="text-sm text-muted mt-1">Configure integrations, custom branding, and team notifications.</p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Team Members</h2>
            <p className="text-xs text-muted">Manage who has access to your workspace captures.</p>
          </div>
          <Link
            href="/settings/members"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Manage Members →
          </Link>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Integrations */}
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">Webhooks & Notifications</h2>
              <p className="text-xs text-muted">Receive Slack, Discord, or custom webhook alerts when a new capture is saved.</p>
            </div>
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
              Active
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Webhook URL (Slack / Discord / Zapier)
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white font-mono"
            />
            <p className="text-[11px] text-muted mt-1.5">
              We&apos;ll POST a JSON payload with video thumbnail and share URL every time a new bug/recording is created.
            </p>
          </div>
        </div>

        {/* Section 2: Custom Branding */}
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">White-label & Custom Branding</h2>
              <p className="text-xs text-muted">Customize how shared capture links appear to clients or guests.</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              userPlan === "free"
                ? "text-indigo-600 bg-indigo-50 border-indigo-100"
                : "text-amber-600 bg-amber-50 border-amber-100"
            }`}>
              {userPlan === "free" ? "Pro Only" : "Active"}
            </span>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${userPlan === "free" ? "opacity-50" : ""}`}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                disabled={userPlan === "free"}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={userPlan === "free" ? "Upgrade to Pro to customize" : "Acme Corp"}
                className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white disabled:bg-subtle disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Custom Logo URL (PNG/SVG)
              </label>
              <input
                type="url"
                value={logoUrl}
                disabled={userPlan === "free"}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder={userPlan === "free" ? "Upgrade to Pro to upload logo" : "https://acme.com/logo.png"}
                className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white disabled:bg-subtle disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <label className={`flex items-center gap-3 pt-2 ${userPlan === "free" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
            <input
              type="checkbox"
              checked={hideWatermark}
              disabled={userPlan === "free"}
              onChange={(e) => setHideWatermark(e.target.checked)}
              className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
            />
            <span className="text-xs font-medium text-foreground">
              Hide &quot;Powered by Mazway&quot; watermark on public share pages
            </span>
          </label>

          {/* Custom Domain (white-label) */}
          <div className={`pt-3 border-t border-border/60 ${userPlan === "free" ? "opacity-50" : ""}`}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              Custom Domain {userPlan === "free" && <span className="text-indigo-600">(Pro)</span>}
            </label>
            <input
              type="text"
              value={customDomain}
              disabled={userPlan === "free"}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder={userPlan === "free" ? "Upgrade to Pro to point CNAME" : "captures.yourcompany.com"}
              className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white font-mono disabled:bg-subtle disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-muted mt-1.5">
              Point your domain&apos;s CNAME to the dashboard host to serve share pages from your own brand.
            </p>
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition-colors shadow-sm"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
          {saved && <span className="text-xs font-medium text-emerald-600">✓ Settings saved successfully!</span>}
        </div>
      </form>
    </div>
  );
}
