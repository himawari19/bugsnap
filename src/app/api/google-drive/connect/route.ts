import { NextResponse } from "next/server";
import { authenticatedUser, createConnectUrl } from "@/lib/google-drive";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ url: await createConnectUrl(user.id) }); }
  catch { return NextResponse.json({ error: "Unable to start Google authorization" }, { status: 500 }); }
}
