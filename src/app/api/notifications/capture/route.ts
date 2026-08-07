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
      .select("title, type, site_url, os, browser, workspace_id")
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

    const payload = {
      content: `${typeLabel} — New capture: **${capture.title || "Untitled"}**\n${captureUrl}`,
      text: `${typeLabel} New capture: ${capture.title || "Untitled"}\n${captureUrl}`,
      embeds: [
        {
          title: capture.title || "Untitled",
          url: captureUrl,
          color: 0x4f46e5,
          fields: [
            { name: "Type", value: capture.type || "screenshot", inline: true },
            { name: "OS", value: capture.os || "Unknown", inline: true },
            { name: "Browser", value: capture.browser || "Unknown", inline: true },
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
