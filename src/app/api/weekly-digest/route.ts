import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Capture = { id: string; type: string; workspace_id: string | null };
type Workspace = { id: string; name: string; owner_user_id: string | null };

export async function GET(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [workspaceResult, captureResult] = await Promise.all([
      supabase.from("workspaces").select("id,name,owner_user_id"),
      supabase.from("captures").select("id,type,workspace_id").gte("created_at", since),
    ]);
    if (workspaceResult.error) throw workspaceResult.error;
    if (captureResult.error) throw captureResult.error;

    const workspaces = (workspaceResult.data ?? []) as Workspace[];
    const captures = (captureResult.data ?? []) as Capture[];
    const captureIds = captures.map(({ id }) => id);
    const [commentResult, viewResult, ownerResult] = await Promise.all([
      captureIds.length
        ? supabase.from("comments").select("capture_id").in("capture_id", captureIds).gte("created_at", since)
        : Promise.resolve({ data: [], error: null }),
      captureIds.length
        ? supabase.from("capture_views").select("capture_id").in("capture_id", captureIds).gte("viewed_at", since)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("users").select("id,email").in("id", workspaces.flatMap((w) => w.owner_user_id ? [w.owner_user_id] : [])),
    ]);
    if (commentResult.error) throw commentResult.error;
    if (viewResult.error) throw viewResult.error;
    if (ownerResult.error) throw ownerResult.error;

    const commentsByCapture = new Map<string, number>();
    const viewsByCapture = new Map<string, number>();
    for (const row of commentResult.data ?? []) commentsByCapture.set(row.capture_id, (commentsByCapture.get(row.capture_id) ?? 0) + 1);
    for (const row of viewResult.data ?? []) viewsByCapture.set(row.capture_id, (viewsByCapture.get(row.capture_id) ?? 0) + 1);
    const ownerEmails = new Map((ownerResult.data ?? []).map((owner) => [owner.id, owner.email]));

    const digests = workspaces.flatMap((workspace) => {
      const email = workspace.owner_user_id ? ownerEmails.get(workspace.owner_user_id) : null;
      if (!email) return [];
      const workspaceCaptures = captures.filter((capture) => capture.workspace_id === workspace.id);
      return [{
        email,
        workspace: workspace.name,
        captures: workspaceCaptures.length,
        videos: workspaceCaptures.filter(({ type }) => type === "video").length,
        comments: workspaceCaptures.reduce((sum, { id }) => sum + (commentsByCapture.get(id) ?? 0), 0),
        views: workspaceCaptures.reduce((sum, { id }) => sum + (viewsByCapture.get(id) ?? 0), 0),
      }];
    });

    if (!process.env.RESEND_API_KEY) return NextResponse.json({ ok: true, dryRun: true, workspaces: digests.length });
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.akusaraproject.my.id";

    for (const digest of digests) {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || "BugSnap <no-reply@bugsnap.akusaraproject.my.id>",
          to: [digest.email],
          subject: `BugSnap Weekly Digest — ${digest.workspace}`,
          html: `<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;border:1px solid #e2e8f0;border-radius:8px;"><img src="${appUrl}/icon.png" width="40" height="40" alt="BugSnap" style="display:block;margin-bottom:20px;" /><h2 style="font-size:20px;font-weight:600;color:#0f172a;margin-top:0;">BugSnap Weekly Digest</h2><p style="color:#475569;font-size:15px;line-height:24px;"><strong>${digest.workspace}</strong> activity over the last 7 days.</p><blockquote style="margin:16px 0;padding:12px 16px;border-left:4px solid #3b82f6;background-color:#f8fafc;color:#1e293b;font-size:15px;border-radius:0 4px 4px 0;">${digest.captures} captures · ${digest.videos} videos · ${digest.comments} comments · ${digest.views} views</blockquote><hr style="margin:24px 0;border:0;border-top:1px solid #e2e8f0;" /><p style="color:#94a3b8;font-size:12px;margin-bottom:0;">This is an automated weekly digest from BugSnap.</p></div>`,
        }),
      });
      if (!response.ok) throw new Error(`Resend failed (${response.status})`);
    }

    return NextResponse.json({ ok: true, workspaces: digests.length });
  } catch (error) {
    console.error("Weekly digest failed", error);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }
}
