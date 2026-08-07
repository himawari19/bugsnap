/**
 * Test config — shared Supabase client + helpers for the BugSnap test suite.
 * Uses the SAME anon key as the production extension so tests reflect real
 * runtime behavior. Run with: node --test tests/
 */
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read .env.local like Next.js does (NEXT_PUBLIC_ vars are inlined at build,
// but for tests we parse the file directly).
function loadEnv() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env.local — tests need NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  const raw = fs.readFileSync(envPath, "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Test owner email (must exist in public.users — the dashboard user).
export const TEST_OWNER_EMAIL = "wahyu.priyono@magnusdigital.co.id";

// Deterministic title prefix so we can clean up test rows.
export const TEST_PREFIX = "__test__";

let cleanupQueue = [];

/** Register a capture id for cleanup at the end of the run. */
export function trackCapture(id) {
  cleanupQueue.push(id);
}

/** Delete all rows we created during the run. */
export async function cleanupTestData() {
  if (cleanupQueue.length) {
    await supabase.from("captures").delete().in("id", cleanupQueue);
    cleanupQueue = [];
  }
  // Also purge any stray test captures by title prefix (safety net).
  const { data } = await supabase
    .from("captures")
    .select("id")
    .ilike("title", `${TEST_PREFIX}%`);
  if (data?.length) {
    await supabase.from("captures").delete().in("id", data.map((r) => r.id));
  }
}

/** Insert a test capture via the exact RPC the extension uses. */
export async function insertTestCapture(overrides = {}) {
  const { data, error } = await supabase.rpc("insert_capture_by_email", {
    p_owner_email: overrides.p_owner_email ?? TEST_OWNER_EMAIL,
    p_title: overrides.p_title ?? `${TEST_PREFIX} capture ${Date.now()}`,
    p_type: overrides.p_type ?? "screenshot",
    p_drive_url: overrides.p_drive_url ?? "https://drive.google.com/file/d/TEST/view",
    p_dev_logs: overrides.p_dev_logs ?? [],
    p_window_size: overrides.p_window_size ?? "1920x1080",
    p_duration: overrides.p_duration ?? 0,
    p_os: overrides.p_os ?? "Windows",
    p_browser: overrides.p_browser ?? "Chrome 149.0.7827.201",
    p_site_url: overrides.p_site_url ?? "https://example.com",
  });
  return { data, error };
}

/** Generate a unique test email (never used in production). */
export function randomEmail(prefix = "test") {
  return `${prefix}.${Date.now()}@bugsnap.test`;
}

// ---------------------------------------------------------------------------
// Direct SQL helper (Management API) — used by tests that must bypass RLS
// (e.g. setting a password/expiry as the table owner would).
// Reads SUPABASE_PAT from .env.local (not committed).
// ---------------------------------------------------------------------------
let _pat = null;
export function getPat() {
  if (_pat) return _pat;
  const envPath = path.join(__dirname, "..", ".env.local");
  if (fs.existsSync(envPath)) {
    const raw = fs.readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*SUPABASE_PAT\s*=\s*(.*)\s*$/i);
      if (m) {
        _pat = m[1].replace(/^["']|["']$/g, "");
        break;
      }
    }
  }
  return _pat;
}

export async function sql(query) {
  const pat = getPat();
  if (!pat) {
    throw new Error(
      "SUPABASE_PAT is required in .env.local for SQL-backed tests (password/expiry setup)."
    );
  }
  const ref = SUPABASE_URL.replace("https://", "").replace(".supabase.co", "");
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SQL failed (${res.status}): ${body}`);
  }
  return res.json();
}
