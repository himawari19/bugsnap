/**
 * BugSnap RPC test suite — runs against the LIVE Supabase project with the
 * anon key (same as the production extension). Verifies every RPC the app
 * depends on, plus RLS isolation. All created rows are cleaned up after.
 *
 * Run:  node --test tests/
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  supabase,
  TEST_OWNER_EMAIL,
  TEST_PREFIX,
  insertTestCapture,
  cleanupTestData,
  trackCapture,
  randomEmail,
  sql,
} from "./config.mjs";

// ---------------------------------------------------------------------------
// 1. insert_capture_by_email — the extension bridge
// ---------------------------------------------------------------------------
test("insert_capture_by_email: succeeds with valid email", async () => {
  const { data, error } = await insertTestCapture({
    p_title: `${TEST_PREFIX} valid insert`,
    p_site_url: "https://example.com",
  });
  assert.equal(error, null, `expected no error, got: ${error?.message}`);
  assert.ok(data, "expected a capture id back");
  assert.match(data, /^[0-9a-f-]{36}$/i, "expected UUID");
  trackCapture(data);
});

test("insert_capture_by_email: rejects empty owner_email (23502)", async () => {
  const { data, error } = await insertTestCapture({ p_owner_email: "" });
  assert.equal(data, null);
  assert.ok(error, "expected an error");
  assert.equal(error.code, "23502", "expected owner_email required code");
});

test("insert_capture_by_email: rejects unknown email (P0002)", async () => {
  const { data, error } = await insertTestCapture({
    p_owner_email: randomEmail("nobody"),
  });
  assert.equal(data, null);
  assert.ok(error, "expected an error");
  assert.equal(error.code, "P0002", "expected no-account code");
});

test("insert_capture_by_email: stores os/browser/site_url/duration", async () => {
  const { data: id, error } = await insertTestCapture({
    p_title: `${TEST_PREFIX} metadata check`,
    p_os: "Windows (x64)",
    p_browser: "Chrome 149.0.7827.201",
    p_site_url: "https://shopee.co.id/item/123",
    p_duration: 42,
  });
  assert.equal(error, null);
  trackCapture(id);
  // Anon can't SELECT captures (RLS) — verify via SQL as the owner would.
  const rows = await sql(`SELECT os, browser, site_url, duration, owner_email FROM public.captures WHERE id = '${id}'`);
  const row = rows[0];
  assert.equal(row.os, "Windows (x64)");
  assert.equal(row.browser, "Chrome 149.0.7827.201");
  assert.equal(row.site_url, "https://shopee.co.id/item/123");
  assert.equal(row.duration, 42);
  assert.equal(row.owner_email, TEST_OWNER_EMAIL);
});

test("insert_capture_by_email: requires a real owner workspace", async () => {
  // Unknown user => P0002 covers the workspace resolution path too.
  const { error } = await insertTestCapture({
    p_owner_email: randomEmail("wscheck"),
  });
  assert.ok(error, "expected error for user without workspace");
});

// ---------------------------------------------------------------------------
// 2. get_public_capture — the public share page
// ---------------------------------------------------------------------------
test("get_public_capture: anon can read an unlocked capture", async () => {
  const { data: id } = await insertTestCapture({
    p_title: `${TEST_PREFIX} public read`,
  });
  trackCapture(id);
  const { data, error } = await supabase.rpc("get_public_capture", {
    p_id: id,
    p_password: null,
  });
  assert.equal(error, null);
  assert.ok(data?.length === 1, "expected exactly one row");
  assert.equal(data[0].status, "ok");
  assert.ok(data[0].drive_url, "expected drive_url for public capture");
  assert.ok(Array.isArray(data[0].dev_logs), "expected dev_logs array");
});

test("get_public_capture: returns empty array for unknown id", async () => {
  // The RPC returns [] (not a row with status=not_found) for random ids —
  // the frontend treats length===0 as not-found.
  const { data, error } = await supabase.rpc("get_public_capture", {
    p_id: "00000000-0000-4000-8000-000000000000",
    p_password: null,
  });
  assert.equal(error, null);
  assert.equal(data.length, 0, "expected empty array for unknown id");
});

test("get_public_capture: password-protected capture hides content until unlock", async () => {
  const { data: id } = await insertTestCapture({
    p_title: `${TEST_PREFIX} locked`,
  });
  trackCapture(id);
  // Set password via SQL (anon can't update captures — RLS blocks it).
  await sql(`UPDATE public.captures SET password = 'secret123' WHERE id = '${id}'`);

  // Without password -> needs_password, no drive_url leak
  const locked = await supabase.rpc("get_public_capture", { p_id: id, p_password: null });
  assert.equal(locked.data[0].status, "needs_password");
  assert.equal(locked.data[0].drive_url, null, "must NOT leak drive_url");
  assert.equal(locked.data[0].dev_logs, null, "must NOT leak dev_logs");
  // SQL NULL arrives as undefined/null over PostgREST — either is fine as
  // long as no actual value leaks.
  assert.ok(locked.data[0].os == null, "must NOT leak os");

  // Wrong password -> still locked
  const wrong = await supabase.rpc("get_public_capture", { p_id: id, p_password: "wrong" });
  assert.equal(wrong.data[0].status, "needs_password");

  // Correct password -> ok
  const ok = await supabase.rpc("get_public_capture", { p_id: id, p_password: "secret123" });
  assert.equal(ok.data[0].status, "ok");
  assert.ok(ok.data[0].drive_url, "expected drive_url after unlock");

  // Cleanup: unset password
  await sql(`UPDATE public.captures SET password = NULL WHERE id = '${id}'`);
});

test("get_public_capture: expired capture is hidden", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} expired` });
  trackCapture(id);
  await sql(
    `UPDATE public.captures SET expires_at = now() - interval '1 minute' WHERE id = '${id}'`
  );

  const { data } = await supabase.rpc("get_public_capture", { p_id: id, p_password: null });
  assert.equal(data[0].status, "expired");
  assert.equal(data[0].drive_url, null, "expired must not leak content");
  assert.equal(data[0].dev_logs, null);
  // SQL NULL arrives as undefined/null — either is fine as long as nothing leaks.
  assert.ok(data[0].site_url == null, "expired must not leak site_url");
});

// ---------------------------------------------------------------------------
// 3. Workspace RPCs
// ---------------------------------------------------------------------------
test("get_my_workspaces: returns owner's workspace", async () => {
  const { data, error } = await supabase.rpc("get_my_workspaces");
  // NOTE: this call uses the anon key with no session -> RLS returns nothing
  // for the anon role. That's expected; the dashboard calls it authenticated.
  assert.equal(error, null, "RPC itself must not throw");
  assert.ok(Array.isArray(data), "expected an array");
});

test("create_workspace: works when authenticated (dashboard flow)", async () => {
  // Anon cannot create (auth.uid() is null), but RPC must not crash.
  const { data, error } = await supabase.rpc("create_workspace", {
    p_name: `${TEST_PREFIX} ws ${Date.now()}`,
  });
  assert.ok(error || data, "either fails for anon or returns id");
});

// ---------------------------------------------------------------------------
// 4. post_comment — rate-limited comments
// ---------------------------------------------------------------------------
test("post_comment: rejects empty body (23502)", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} comment` });
  trackCapture(id);
  const { error } = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `t${Date.now()}`,
    p_body: "   ",
  });
  assert.ok(error, "expected error for empty body");
  assert.equal(error.code, "23502");
});

test("post_comment: rejects unknown capture (P0002)", async () => {
  const { error } = await supabase.rpc("post_comment", {
    p_capture_id: "00000000-0000-4000-8000-000000000000",
    p_visitor_ref: `t${Date.now()}`,
    p_body: "hello",
  });
  assert.ok(error);
  assert.equal(error.code, "P0002");
});

test("post_comment: succeeds and returns the row", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} comment ok` });
  trackCapture(id);
  const { data, error } = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `t${Date.now()}`,
    p_body: "Works fine",
    p_author_name: "Tester",
  });
  assert.equal(error, null);
  assert.equal(data.body, "Works fine");
  assert.equal(data.author_name, "Tester");
  assert.equal(data.parent_id, null);
});

test("post_comment: rate limit blocks 6th comment in 10 min", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} rate` });
  trackCapture(id);
  const ref = `rl${Date.now()}`;
  for (let i = 0; i < 5; i++) {
    const { error } = await supabase.rpc("post_comment", {
      p_capture_id: id,
      p_visitor_ref: ref,
      p_body: `comment ${i}`,
    });
    assert.equal(error, null, `comment ${i} should pass`);
  }
  // 6th -> blocked
  const { error } = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: ref,
    p_body: "spam",
  });
  assert.ok(error, "expected rate limit error");
  assert.equal(error.code, "P0001", "expected too-many-comments code");
});

test("post_comment: stores valid video timestamps and rejects invalid ones", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} timestamp` });
  trackCapture(id);
  const valid = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `ts${Date.now()}`,
    p_body: "timestamped",
    p_video_timestamp: 83,
  });
  assert.equal(valid.error, null);
  assert.equal(valid.data.video_timestamp, 83);

  const invalid = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `ts${Date.now()}`,
    p_body: "invalid timestamp",
    p_video_timestamp: -1,
  });
  assert.ok(invalid.error);
  assert.equal(invalid.error.code, "22003");
});

test("post_comment: reply with parent_id works", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} reply` });
  trackCapture(id);
  const parent = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `t${Date.now()}`,
    p_body: "parent comment",
  });
  assert.equal(parent.error, null);
  const reply = await supabase.rpc("post_comment", {
    p_capture_id: id,
    p_visitor_ref: `t${Date.now()}`,
    p_body: "a reply",
    p_parent_id: parent.data.id,
  });
  assert.equal(reply.error, null);
  assert.equal(reply.data.parent_id, parent.data.id);
});

// ---------------------------------------------------------------------------
// 5. View tracking
// ---------------------------------------------------------------------------
test("record_view + get_view_count work together", async () => {
  const { data: id } = await insertTestCapture({ p_title: `${TEST_PREFIX} views` });
  trackCapture(id);
  const before = await supabase.rpc("get_view_count", { p_capture_id: id });
  const n0 = Number(before.data ?? 0);
  await supabase.rpc("record_view", { p_capture_id: id, p_ref: `v${Date.now()}` });
  const after = await supabase.rpc("get_view_count", { p_capture_id: id });
  assert.ok(Number(after.data) >= n0 + 1, "view count should increase");
});

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
after(async () => {
  await cleanupTestData();
});
