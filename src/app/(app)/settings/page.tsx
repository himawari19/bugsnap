"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useT } from "@/components/I18nProvider";

export default function SettingsPage() {
  const { t } = useT();
  const router = useRouter();
  const [webhookUrl, setWebhookUrl] = useState("");
  const [brandName, setBrandName] = useState("mazway");
  const [logoUrl, setLogoUrl] = useState("");
  const [hideWatermark, setHideWatermark] = useState(false);
  const [customDomain, setCustomDomain] = useState("");
  const [userPlan, setUserPlan] = useState<"free" | "pro">("free");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const [driveEmail, setDriveEmail] = useState<string | null>(null);
  const [driveLoading, setDriveLoading] = useState(true);
  const [driveActionLoading, setDriveActionLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState<string | null>(null);
  const [connectDriveModalOpen, setConnectDriveModalOpen] = useState(false);

  // Load the active workspace id from the ?ws= URL param (same pattern as
  // the dashboard layout), falling back to null when absent.
  const [activeWsId, setActiveWsId] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    setActiveWsId(url.searchParams.get("ws"));

    const driveResult = url.searchParams.get("drive");
    if (driveResult === "connected") {
      setDriveSuccess(t("settings.driveConnectedOk"));
      setDriveError(null);
    } else if (driveResult === "error") {
      setDriveError(t("settings.driveError"));
      setDriveSuccess(null);
    }

    if (driveResult === "connected" || driveResult === "error") {
      url.searchParams.delete("drive");
      router.replace(`${url.pathname}${url.search}${url.hash}`, { scroll: false });
    }
  }, [router, t]);

  useEffect(() => {
    // Load workspace settings
    supabase.auth.getSession().then(async ({ data }) => {
      const u = data.session?.user;
      if (!u) return;

      let plan = (u.user_metadata?.plan || "free") as "free" | "pro";
      // Prefer plan from public.users (source of truth via Stripe webhook)
      if (u.email) {
        const { data: userRow } = await supabase
          .from("users")
          .select("plan")
          .ilike("email", u.email)
          .maybeSingle();
        if (userRow?.plan === "pro") plan = "pro";
      }
      setUserPlan(plan);

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

  // eslint-disable-next-line react-hooks/exhaustive-deps -- driveRequest is stable per t
  async function driveRequest(path: string, init?: RequestInit) {
    const { data, error: sessionError } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (sessionError || !token) throw new Error(t("settings.sessionExpired"));
    const response = await fetch(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${token}` },
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || t("settings.driveError"));
    return result;
  }

  useEffect(() => {
    let cancelled = false;
    driveRequest("/api/google-drive/status")
      .then((result) => {
        if (cancelled) return;
        setDriveConnected(Boolean(result.connected));
        setDriveEmail(result.email || null);
      })
      .catch((err) => { if (!cancelled) setDriveError(err instanceof Error ? err.message : t("settings.driveStatusError")); })
      .finally(() => { if (!cancelled) setDriveLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function connectDrive() {
    if (driveActionLoading) return;
    setDriveActionLoading(true);
    setDriveError(null);
    try {
      const result = await driveRequest("/api/google-drive/connect", { method: "POST" });
      if (!result.url) throw new Error(t("settings.noAuthUrl"));
      window.location.assign(result.url);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : t("settings.connectError"));
      setDriveActionLoading(false);
    }
  }

  async function disconnectDrive() {
    if (driveActionLoading) return;
    setDriveActionLoading(true);
    setDriveError(null);
    try {
      await driveRequest("/api/google-drive/disconnect", { method: "DELETE" });
      setDriveConnected(false);
      setDriveEmail(null);
    } catch (err) {
      setDriveError(err instanceof Error ? err.message : t("settings.disconnectError"));
    } finally {
      setDriveActionLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      if (!activeWsId) {
        throw new Error(t("settings.noWs"));
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
      const msg = err instanceof Error ? err.message : t("settings.failedSave");
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("settings.title")}</h1>
        <p className="text-sm text-muted mt-1">{t("settings.subtitle")}</p>
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">{t("settings.teamMembers")}</h2>
            <p className="text-xs text-muted">{t("settings.teamMembersHint")}</p>
          </div>
          <Link
            href="/settings/members"
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            {t("settings.manageMembers")}
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{t("settings.googleDrive")}</h2>
              {!driveLoading && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${driveConnected ? "text-emerald-700 bg-emerald-50 border-emerald-200" : "text-muted bg-subtle border-border"}`}>{driveConnected ? t("settings.connected") : t("settings.notConnected")}</span>}
            </div>
            <p className="text-xs text-muted mt-1">{driveLoading ? t("settings.checkingDrive") : driveConnected ? t("settings.driveUses", { email: driveEmail || "your connected Google account" }) : t("settings.driveConnectHint")}</p>
          </div>
          {driveConnected ? (
            <button type="button" onClick={disconnectDrive} disabled={driveActionLoading} className="px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-semibold hover:bg-red-50 disabled:opacity-50 transition-colors">{driveActionLoading ? t("settings.disconnecting") : t("settings.disconnect")}</button>
          ) : (
            <button type="button" onClick={() => setConnectDriveModalOpen(true)} disabled={driveLoading || driveActionLoading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">{t("settings.connectDrive")}</button>
          )}
        </div>
        {driveSuccess && <p role="status" className="text-xs text-emerald-600 mt-3">{driveSuccess}</p>}
        {driveError && <p role="alert" className="text-xs text-red-600 mt-3">{driveError}</p>}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Integrations */}
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("settings.webhooksTitle")}</h2>
              <p className="text-xs text-muted">{t("settings.webhookHint")}</p>
            </div>
            {webhookUrl.trim() ? (
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                {t("settings.active")}
              </span>
            ) : (
              <span className="text-xs font-semibold text-muted bg-subtle px-2 py-0.5 rounded-full border border-border">
                {t("settings.notConfigured")}
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              {t("settings.webhookLabel")}
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white font-mono"
            />
            <p className="text-[11px] text-muted mt-1.5">
              {t("settings.webhookPost")}
            </p>
          </div>
        </div>

        {/* Section 2: Custom Branding */}
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">{t("settings.brandingTitle")}</h2>
              <p className="text-xs text-muted">{t("settings.brandingHint")}</p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
              userPlan === "free"
                ? "text-indigo-600 bg-indigo-50 border-indigo-100"
                : "text-amber-600 bg-amber-50 border-amber-100"
            }`}>
              {userPlan === "free" ? t("settings.proOnly") : t("settings.active")}
            </span>
          </div>

          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${userPlan === "free" ? "opacity-50" : ""}`}>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("settings.brandName")}
              </label>
              <input
                type="text"
                value={brandName}
                disabled={userPlan === "free"}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder={userPlan === "free" ? t("settings.brandPlaceholderFree") : t("settings.brandPlaceholder")}
                className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white disabled:bg-subtle disabled:cursor-not-allowed"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("settings.logoLabel")}
              </label>
              <input
                type="url"
                value={logoUrl}
                disabled={userPlan === "free"}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder={userPlan === "free" ? t("settings.logoPlaceholderFree") : t("settings.logoPlaceholder")}
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
              {t("settings.hideWatermark")}
            </span>
          </label>

          {/* Custom Domain (white-label) */}
          <div className={`pt-3 border-t border-border/60 ${userPlan === "free" ? "opacity-50" : ""}`}>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted mb-1.5">
              {t(userPlan === "free" ? "settings.customDomainPro" : "settings.customDomain")} {userPlan === "free" && <span className="text-indigo-600">({t("settings.proOnly")})</span>}
            </label>
            <input
              type="text"
              value={customDomain}
              disabled={userPlan === "free"}
              onChange={(e) => setCustomDomain(e.target.value)}
              placeholder={userPlan === "free" ? t("settings.domainPlaceholderFree") : t("settings.domainPlaceholder")}
              className="w-full text-sm rounded-lg border border-border px-3.5 py-2.5 outline-none focus:border-indigo-500 bg-white font-mono disabled:bg-subtle disabled:cursor-not-allowed"
            />
            <p className="text-[11px] text-muted mt-1.5">
              {t("settings.domainHint")}
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
            {saving ? t("settings.saving") : t("settings.save")}
          </button>
          {saved && <span className="text-xs font-medium text-emerald-600">{t("settings.saved")}</span>}
        </div>
      </form>

      {connectDriveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="connect-drive-title">
          <button className="absolute inset-0 bg-black/40" aria-label={t("common.close")} onClick={() => !driveActionLoading && setConnectDriveModalOpen(false)} />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-white p-6 shadow-xl">
            <h2 id="connect-drive-title" className="text-lg font-bold text-foreground">{t("settings.connectDriveQ")}</h2>
            <p className="text-sm text-muted mt-2">{t("settings.connectDriveDesc")}</p>
            {driveError && <p role="alert" className="text-xs text-red-600 mt-3">{driveError}</p>}
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border">
              <button type="button" onClick={() => setConnectDriveModalOpen(false)} disabled={driveActionLoading} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-subtle rounded-lg disabled:opacity-50">{t("common.cancel")}</button>
              <button type="button" onClick={connectDrive} disabled={driveActionLoading} className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50">{driveActionLoading ? t("settings.connecting") : t("settings.continueToGoogle")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
