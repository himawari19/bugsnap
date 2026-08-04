import { NextResponse } from "next/server";
import { authenticatedUser } from "@/lib/google-drive";
import { createServiceClient } from "@/lib/supabase-server";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await createServiceClient().from("google_drive_connections").select("google_email,updated_at").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Unable to read connection" }, { status: 500 });
  return NextResponse.json({ connected: Boolean(data), email: data?.google_email ?? null, updatedAt: data?.updated_at ?? null });
}
