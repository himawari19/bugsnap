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

    // 1. Verify caller identity
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Enforce Super Admin list
    if (!getAdminEmails().includes(user.email.toLowerCase())) {
      return NextResponse.json({ error: "Forbidden: Super Admin only" }, { status: 403 });
    }

    // 3. Parse request body
    const body = await req.json();
    const targetUserId = body?.user_id;
    const suspended = Boolean(body?.suspended);

    if (!targetUserId) {
      return NextResponse.json({ error: "Missing user_id" }, { status: 400 });
    }

    // Prevent admin from suspending themselves
    if (targetUserId === user.id) {
      return NextResponse.json({ error: "You cannot suspend your own account" }, { status: 400 });
    }

    // 4. Update the suspended flag
    const { data, error } = await supabase
      .from("users")
      .update({ suspended })
      .eq("id", targetUserId)
      .select("id, email, suspended")
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, user: data });
  } catch (err) {
    console.error("Admin toggle-suspend error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
