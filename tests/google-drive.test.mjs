import { test } from "node:test";
import assert from "node:assert/strict";
import { compensatedDeleteError, decideDeleteReconciliation, isUuid, parseDriveFileId, resultFromAudit } from "../src/lib/google-drive-values.ts";

test("canonical UUID validation rejects malformed and non-RFC variants", () => {
  assert.equal(isUuid("550e8400-e29b-41d4-a716-446655440000"), true);
  assert.equal(isUuid("550E8400-E29B-41D4-A716-446655440000"), true);
  assert.equal(isUuid("550e8400-e29b-01d4-a716-446655440000"), false);
  assert.equal(isUuid("550e8400-e29b-41d4-7716-446655440000"), false);
  assert.equal(isUuid("550e8400-e29b-41d4-a716-44665544000-"), false);
  assert.equal(isUuid("00000000-0000-0000-0000-000000000000"), false);
});

test("exact Drive IDs are accepted only from Google hosts", () => {
  assert.equal(parseDriveFileId("https://drive.google.com/file/d/ABCdef_12345/view"), "ABCdef_12345");
  assert.equal(parseDriveFileId("https://docs.google.com/open?id=XYZabc-98765"), "XYZabc-98765");
  assert.equal(parseDriveFileId("https://evil.example/file/d/ABCdef_12345/view"), null);
  assert.equal(parseDriveFileId("not a url"), null);
});

test("audit results preserve deletion and idempotent replay state", () => {
  assert.deepEqual(resultFromAudit({ capture_id: "capture", outcome: "deleted", error: null }), { captureId: "capture", ok: true, outcome: "deleted" });
  assert.deepEqual(resultFromAudit({ capture_id: "capture", outcome: "already_deleted", error: null }), { captureId: "capture", ok: true, outcome: "already_deleted" });
  assert.deepEqual(resultFromAudit({ capture_id: "capture", outcome: "failed", error: "Not owned" }), { captureId: "capture", ok: false, outcome: "failed", error: "Not owned" });
});

test("post-trash reconciliation replays success and only compensates without a success audit", () => {
  const deleted = { capture_id: "capture", outcome: "deleted", error: null };
  assert.deepEqual(decideDeleteReconciliation(deleted, false), { action: "replay", result: { captureId: "capture", ok: true, outcome: "deleted" } });
  assert.deepEqual(decideDeleteReconciliation(null, false), { action: "compensate" });
  assert.deepEqual(decideDeleteReconciliation({ capture_id: "capture", outcome: "failed", error: "DB failed" }, false), { action: "compensate" });
  assert.deepEqual(decideDeleteReconciliation(null, true), { action: "reconcile" });
  assert.deepEqual(decideDeleteReconciliation(deleted, true), { action: "reconcile" });
});

test("compensation errors accurately distinguish restored and still-trashed files", () => {
  assert.equal(compensatedDeleteError(new Error("DB failed")), "DB failed. The Google Drive file was restored");
  assert.equal(compensatedDeleteError(new Error("DB failed"), new Error("Drive 503")), "DB failed. Google Drive restore also failed: Drive 503");
});
