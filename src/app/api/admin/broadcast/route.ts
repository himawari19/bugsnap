import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const getAdminEmails = () =>
  (process.env.SUPER_ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!getAdminEmails().includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json({ error: "RESEND_API_KEY not configured" }, { status: 400 });
    }

    const body = await req.json();
    const subject = body?.subject?.trim();
    const htmlBody = body?.html?.trim();

    if (!subject || !htmlBody) {
      return NextResponse.json({ error: "Subject and HTML body are required" }, { status: 400 });
    }

    // Fetch all user emails
    const { data: users, error: usersErr } = await supabase.from("users").select("email").is("suspended", false);
    if (usersErr) throw usersErr;
    
    const emails = Array.from(new Set((users || []).map(u => u.email).filter(Boolean)));
    if (emails.length === 0) {
      return NextResponse.json({ ok: true, sentCount: 0 });
    }

    const mailFrom = process.env.RESEND_FROM_EMAIL || "Mazway Dashboard <no-reply@mail.akusaraproject.my.id>";

    // Resend Batch API allows up to 100 emails per request, but we will send individually
    // for safety on free tier (max 2 emails/sec is standard, but since it's tiny we can Promise.all with small chunks).
    const chunkSize = 10;
    let sentCount = 0;

    for (let i = 0; i < emails.length; i += chunkSize) {
      const chunk = emails.slice(i, i + chunkSize);
      
      const promises = chunk.map(async (email) => {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: mailFrom,
            to: [email],
            subject: subject,
            html: htmlBody,
          }),
        });
        if (response.ok) sentCount++;
      });
      
      await Promise.allSettled(promises);
      // Brief pause between chunks
      if (i + chunkSize < emails.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    return NextResponse.json({ ok: true, sentCount });
  } catch (err) {
    console.error("Admin broadcast error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
