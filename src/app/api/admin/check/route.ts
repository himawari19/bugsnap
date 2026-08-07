import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ isAdmin: false });

  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user || !user.email) return NextResponse.json({ isAdmin: false });

    const adminEmails = (process.env.SUPER_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin = adminEmails.includes(user.email.toLowerCase());
    return NextResponse.json({ isAdmin });
  } catch {
    return NextResponse.json({ isAdmin: false });
  }
}
