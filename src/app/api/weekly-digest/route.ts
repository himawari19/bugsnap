import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Weekly Digest — POST /api/weekly-digest?token=CRON_SECRET
 *
 * Counts captures, comments, and views for the last 7 days and emails a
 * summary to the workspace owner via Resend. Guarded by a cron secret so
 * only Vercel Cron (or anyone with the token) can trigger it.
 *
 * Setup (Vercel):
 *   - Add RESEND_API_KEY + RESEND_FROM_EMAIL + CRON_SECRET to env vars.
 *   - Add "crons": [{ "path": "/api/weekly-digest", "schedule": "0 9 * * 1" }]
 *     to vercel.json for a Monday 09:00 digest.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = (await import("@/lib/supabase")).supabase;
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [captures, comments, views] = await Promise.all([
      supabase.from("captures").select("id,type,created_at").gte("created_at", since),
      supabase.from("comments").select("id,created_at").gte("created_at", since),
      supabase.from("capture_views").select("id,created_at").gte("created_at", since),
    ]);
    const viewCount = views.data?.length ?? 0;

    const videos = (captures.data ?? []).filter((c) => c.type === "video").length;
    const screenshots = (captures.data ?? []).length - videos;

    // No owner email table yet — send to the dashboard owner via users table.
    const { data: owners } = await supabase
      .from("users")
      .select("email")
      .limit(1);

    const ownerEmail = owners?.[0]?.email;
    if (!ownerEmail) {
      return NextResponse.json({ error: "No owner email found" }, { status: 404 });
    }

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
        <h2 style="margin:0">📊 Mazway Weekly Digest</h2>
        <p style="color:#666">Your workspace activity over the last 7 days.</p>
        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <tr><td style="padding:12px;border:1px solid #eee;border-radius:8px 0 0 8px">
            <div style="font-size:24px;font-weight:700">${captures.data?.length ?? 0}</div>
            <div style="color:#666;font-size:12px">New captures</div>
          </td>
          <td style="padding:12px;border:1px solid #eee">
            <div style="font-size:24px;font-weight:700">${videos}</div>
            <div style="color:#666;font-size:12px">Videos</div>
          </td>
          <td style="padding:12px;border:1px solid #eee">
            <div style="font-size:24px;font-weight:700">${screenshots}</div>
            <div style="color:#666;font-size:12px">Screenshots</div>
          </td>
          <td style="padding:12px;border:1px solid #eee;border-radius:0 8px 8px 0">
            <div style="font-size:24px;font-weight:700">${comments.data?.length ?? 0}</div>
            <div style="color:#666;font-size:12px">Comments</div>
          </td>
          <td style="padding:12px;border:1px solid #eee">
            <div style="font-size:24px;font-weight:700">${viewCount}</div>
            <div style="color:#666;font-size:12px">Views</div>
          </td>
        </table>
        <p style="color:#999;font-size:12px">Open your dashboard to see the full activity.</p>
      </div>`;

    // Resend (email provider) — skip silently if not configured so the
    // endpoint stays a no-op during local dev.
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        captures: captures.data?.length ?? 0,
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Mazway <digest@mazway.app>",
        to: [ownerEmail],
        subject: "📊 Mazway Weekly Digest",
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json({ error: "Resend failed", detail: body }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn("Weekly digest failed:", err);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
