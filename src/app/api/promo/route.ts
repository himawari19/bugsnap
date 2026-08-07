import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "promo_banner")
      .maybeSingle();

    return NextResponse.json({
      ok: true,
      promo: data?.value ?? null,
    });
  } catch (err) {
    console.error("Promo fetch error:", err);
    return NextResponse.json({ ok: true, promo: null });
  }
}