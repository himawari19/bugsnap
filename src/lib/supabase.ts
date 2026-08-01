import { createClient } from "@supabase/supabase-js";

// ponytail: fail loudly instead of silently falling back to a hardcoded
// production key that could get committed. Set both vars in .env.local.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY env vars."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
