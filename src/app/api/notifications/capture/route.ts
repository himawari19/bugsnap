import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const captureId = body?.capture_id;
    if (!captureId) {
      return NextResponse.json({ error: "Missing capture_id" }, { status: 400 });
    }

    const supabase = createServiceClient();

    const { data: capture, error: captureError } = await supabase
      .from("captures")
      .select("title, type, site_url, os, browser, workspace_id, dev_logs")
      .eq("id", captureId)
      .single();

    if (captureError || !capture) {
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }

    const { data: settings } = await supabase
      .from("workspace_settings")
      .select("webhook_url")
      .eq("workspace_id", capture.workspace_id)
      .single();

    const webhookUrl = settings?.webhook_url;
    if (!webhookUrl) {
      return NextResponse.json({ ok: true, skipped: "No webhook configured" });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.akusaraproject.my.id";
    const captureUrl = `${appUrl}/v/${captureId}`;
    const typeLabel = capture.type === "video" ? "🎥 Video" : "📸 Screenshot";

    // Compact health summary (new capture shape) or the raw array (legacy).
    // Extract the diagnostics so Slack/Discord get a status line, not just a link.
    const logs = capture.dev_logs;
    const isSummary = !!logs && typeof logs === "object" && !Array.isArray(logs) && typeof (logs as Record<string, unknown>).version === "number";
    const summary = isSummary ? logs as { errors?: number; warnings?: number; failedRequests?: number; topErrors?: string[]; failedUrls?: string[] } : null;
    const consoleErrorsForWebhook = Array.isArray(logs)
      ? logs.filter((l) => l.type === "console" && l.level !== "warn" && l.level !== "warning").length
      : (summary?.errors ?? 0);
    const failedReqForWebhook = Array.isArray(logs)
      ? logs.filter((l) => l.type === "network" && (!l.status || l.status >= 400)).length
      : (summary?.failedRequests ?? 0);
    const topError = summary?.topErrors?.[0] ?? (Array.isArray(logs) ? logs.find((l) => l.type === "console" && l.message)?.message : null);
    const statusLine = consoleErrorsForWebhook + failedReqForWebhook === 0
      ? "✅ No errors detected"
      : `⚠️ ${consoleErrorsForWebhook} console error${consoleErrorsForWebhook === 1 ? "" : "s"}, ${failedReqForWebhook} failed request${failedReqForWebhook === 1 ? "" : "s"}` +
        (topError ? ` · ${topError}`.slice(0, 160) : "");

    const payload = {
      content: `${typeLabel} — New capture: **${capture.title || "Untitled"}**\n${statusLine}\n${captureUrl}`,
      text: `${typeLabel} New capture: ${capture.title || "Untitled"}\n${statusLine}\n${captureUrl}`,
      embeds: [
        {
          title: capture.title || "Untitled",
          url: captureUrl,
          color: consoleErrorsForWebhook + failedReqForWebhook === 0 ? 0x10b981 : 0xef4444,
          fields: [
            { name: "Type", value: capture.type || "screenshot", inline: true },
            { name: "OS", value: capture.os || "Unknown", inline: true },
            { name: "Browser", value: capture.browser || "Unknown", inline: true },
            { name: "Console errors", value: String(consoleErrorsForWebhook), inline: true },
            { name: "Failed requests", value: String(failedReqForWebhook), inline: true },
            ...(topError ? [{ name: "Top error", value: `${topError}`.slice(0, 1024), inline: false }] : []),
            ...(capture.site_url ? [{ name: "Site", value: capture.site_url, inline: false }] : []),
          ],
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`Webhook post failed (${response.status}): ${errText}`);
      return NextResponse.json({ error: "Webhook delivery failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("Failed to send capture webhook:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
