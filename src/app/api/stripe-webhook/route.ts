import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Verify this is a valid Stripe checkout session completed event
    if (body.type === "checkout.session.completed") {
      const session = body.data.object;
      const email = session.customer_details?.email || session.customer_email;

      if (email) {
        // Upgrade the user's plan to 'pro' in the public.users table
        const { error } = await supabase
          .from("users")
          .update({ plan: "pro" })
          .ilike("email", email.trim());

        if (error) {
          console.error("[Stripe Webhook] Error updating user plan:", error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        console.log(`[Stripe Webhook] Successfully upgraded email: ${email} to PRO`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Webhook Error";
    console.error("[Stripe Webhook] Crash:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
