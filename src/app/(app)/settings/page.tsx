"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function SettingsPage() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [brandName, setBrandName] = useState("mazway");
  const [logoUrl, setLogoUrl] = useState("");
  const [hideWatermark, setHideWatermark] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load workspace settings
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) return;

      // For now, load default settings or local storage
      const savedData = localStorage.getItem("mazway_settings");
      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          setWebhookUrl(parsed.webhookUrl || "");
          setBrandName(parsed.brandName || "mazway");
          setLogoUrl(parsed.logoUrl || "");
          setHideWatermark(!!parsed.hideWatermark);
        } catch {}
      }
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const payload = {
        webhookUrl: webhookUrl.trim(),
        brandName: brandName.trim() || "mazway",
        logoUrl: logoUrl.trim(),
        hideWatermark,
      };

      // Save locally & attempt Supabase sync
      localStorage.setItem("mazway_settings", JSON.stringify(payload));
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
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">
              Pro Feature
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Brand Name
              </label>
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Acme Corp"
                className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                Custom Logo URL (PNG/SVG)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://acme.com/logo.png"
                className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 pt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hideWatermark}
              onChange={(e) => setHideWatermark(e.target.checked)}
              className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-xs font-medium text-foreground">
              Hide &quot;Powered by Mazway&quot; watermark on public share pages
            </span>
          </label>
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
