import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-key";

// Non-blocking initialization for Next.js build-time prerendering.
// If env vars are absent on Vercel build time, it returns a placeholder client 
// to prevent build crashes, while using the real variables in the browser.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
