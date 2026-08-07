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

    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim().slice(0, 500) : "";
    const enabled = Boolean(body?.enabled);

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "promo_banner", value: { message, enabled }, updated_at: new Date().toISOString() });

    if (error) throw error;

    return NextResponse.json({ ok: true, promo: { message, enabled } });
  } catch (err) {
    console.error("Admin promo update error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
