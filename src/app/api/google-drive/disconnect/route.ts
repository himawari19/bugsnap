import { NextResponse } from "next/server";
import { authenticatedUser, decrypt } from "@/lib/google-drive";
import { createServiceClient } from "@/lib/supabase-server";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = createServiceClient();
  const { data } = await db.from("google_drive_connections").select("refresh_token").eq("user_id", user.id).maybeSingle();
  if (data?.refresh_token) {
    try { await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(decrypt(data.refresh_token))}`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" } }); } catch { /* Local disconnect remains authoritative. */ }
  }
  const { error } = await db.from("google_drive_connections").delete().eq("user_id", user.id);
  return error ? NextResponse.json({ error: "Unable to disconnect" }, { status: 500 }) : NextResponse.json({ disconnected: true });
}
