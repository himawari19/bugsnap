import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || !body.comment) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { comment } = body;
    const { capture_id, author_name, body: commentBody } = comment;

    if (!capture_id || !commentBody) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1. Get capture to know workspace_id and title
    const { data: capture, error: captureError } = await supabase
      .from("captures")
      .select("title, workspace_id, user_id")
      .eq("id", capture_id)
      .single();

    if (captureError || !capture) {
      console.error("Failed to fetch capture:", captureError);
      return NextResponse.json({ error: "Capture not found" }, { status: 404 });
    }

    // 2. Get workspace to resolve owner_user_id
    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("owner_user_id, name")
      .eq("id", capture.workspace_id)
      .single();

    if (workspaceError || !workspace) {
      console.error("Failed to fetch workspace:", workspaceError);
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // 3. Resolve owner's email address
    const { data: owner, error: ownerError } = await supabase
      .from("users")
      .select("email, id")
      .eq("id", workspace.owner_user_id)
      .single();

    if (ownerError || !owner || !owner.email) {
      console.error("Failed to fetch owner email:", ownerError);
      return NextResponse.json({ error: "Owner email not found" }, { status: 404 });
    }

    // 4. Parse @mentions from the comment body and resolve workspace members
    const mentionedTokens = (commentBody.match(/@([a-zA-Z0-9_.-]+)/g) || []).map((m: string) => m.slice(1).toLowerCase());
    const mentionEmails = new Set<string>();

    if (mentionedTokens.length > 0) {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", capture.workspace_id);

      const memberUserIds = (members?.map((m) => m.user_id) ?? []).filter(Boolean);
      if (memberUserIds.length > 0) {
        const { data: users } = await supabase
          .from("users")
          .select("email, full_name")
          .in("id", memberUserIds);

        const commenterEmail = comment.author_email ? comment.author_email.toLowerCase() : "";
        if (users) {
          for (const u of users) {
            const uEmail = (u.email || "").toLowerCase();
            if (!uEmail || uEmail === commenterEmail) continue;
            const emailPrefix = uEmail.split("@")[0];
            const nameTokens = (u.full_name || "").toLowerCase().split(/\s+/).filter(Boolean);
            const isMentioned = mentionedTokens.some(
              (t: string) => uEmail === t || emailPrefix === t || nameTokens.includes(t)
            );
            if (isMentioned) mentionEmails.add(u.email);
          }
        }
      }
    }

    const ownerEmailLower = owner.email.toLowerCase();
    const commenterEmail = comment.author_email ? comment.author_email.toLowerCase() : "";
    const skipOwner = commenterEmail === ownerEmailLower || mentionEmails.has(owner.email) || mentionEmails.has(ownerEmailLower);

    // 5. Send emails via Resend API
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ ok: true, dryRun: true, message: "RESEND_API_KEY not configured" });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://dashboard.akusaraproject.my.id";
    const captureUrl = `${appUrl}/v/${capture_id}`;
    const mailFrom = process.env.RESEND_FROM_EMAIL || "Mazway Dashboard <no-reply@mail.akusaraproject.my.id>";

    const sendResend = async (to: string, subject: string, html: string) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        },
        body: JSON.stringify({ from: mailFrom, to: [to], subject, html }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Resend failed with status ${response.status}: ${errText}`);
      }
    };

    const bodyHtml = commentBody.replace(/\n/g, "<br>");

    // Mentioned users each get a "you were mentioned" email
    for (const email of Array.from(mentionEmails)) {
      await sendResend(
        email,
        `[Mazway] You were mentioned in a comment on "${capture.title || "Untitled"}"`,
        `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <img src="${appUrl}/icon.png" width="40" height="40" alt="Mazway Dashboard" style="display: block; margin-bottom: 20px;" />
          <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">You were mentioned</h2>
          <p style="color: #475569; font-size: 15px; line-height: 24px;"><strong>${author_name || "Someone"}</strong> mentioned you on <strong>${capture.title || "Untitled"}</strong>:</p>
          <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #10b981; background-color: #f8fafc; color: #1e293b; font-size: 15px; border-radius: 0 4px 4px 0;">${bodyHtml}</blockquote>
          <div style="margin-top: 24px;"><a href="${captureUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 18px; font-weight: 500; font-size: 14px; text-decoration: none; border-radius: 6px;">View Capture & Reply</a></div>
          <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">This is an automated notification from Mazway.</p>
        </div>`
      );
    }

    // Owner gets the standard "New Comment" email unless they are the author or already mentioned
    if (!skipOwner) {
      await sendResend(
        owner.email,
        `[Mazway] New Comment on "${capture.title || "Untitled"}"`,
        `<div style="font-family: system-ui, -apple-system, sans-serif; max-width: 560px; margin: auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <img src="${appUrl}/icon.png" width="40" height="40" alt="Mazway Dashboard" style="display: block; margin-bottom: 20px;" />
          <h2 style="font-size: 20px; font-weight: 600; color: #0f172a; margin-top: 0;">New comment on your capture</h2>
          <p style="color: #475569; font-size: 15px; line-height: 24px;"><strong>${author_name || "Someone"}</strong> commented on <strong>${capture.title || "Untitled"}</strong>:</p>
          <blockquote style="margin: 16px 0; padding: 12px 16px; border-left: 4px solid #3b82f6; background-color: #f8fafc; color: #1e293b; font-size: 15px; border-radius: 0 4px 4px 0;">${bodyHtml}</blockquote>
          <div style="margin-top: 24px;"><a href="${captureUrl}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 10px 18px; font-weight: 500; font-size: 14px; text-decoration: none; border-radius: 6px;">View Capture & Reply</a></div>
          <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e2e8f0;" />
          <p style="color: #94a3b8; font-size: 12px; margin-bottom: 0;">This is an automated notification from Mazway.</p>
        </div>`
      );
    }

    // ponytail: no `mentions` in the response — it leaked member emails to any
    // anonymous caller (enumeration + spam vector) and the client never
    // consumes it (Comments.tsx). Emails are still resolved server-side for
    // the Resend notifications; the response carries only ok/sent.
    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("Failed to send comment notification email:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
