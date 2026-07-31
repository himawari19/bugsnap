import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://whianteevhbjffyxnurc.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaWFudGVldmhiamZmeXhudXJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0NzczODEsImV4cCI6MjEwMTA1MzM4MX0.SIyUwaSFRYYWPXnqoMgkkvn-DQyXq-3Wem1TTLqJrQw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
