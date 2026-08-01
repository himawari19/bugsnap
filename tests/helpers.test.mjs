/**
 * Unit tests for pure helper functions extracted from the app.
 * No DB required. These mirror the exact logic used in the dashboard.
 *
 * Run:  node --test tests/
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// driveFileId / driveThumbUrl / drivePreviewUrl (from captures page)
// ---------------------------------------------------------------------------
function driveFileId(driveUrl) {
  const m = driveUrl.match(/[?&]id=([^&]+)/) || driveUrl.match(/\/d\/([^/]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

test("driveFileId: parses /d/ format", () => {
  assert.equal(
    driveFileId("https://drive.google.com/file/d/ABC123xyz/view?usp=sharing"),
    "ABC123xyz"
  );
});

test("driveFileId: parses ?id= format", () => {
  assert.equal(driveFileId("https://drive.google.com/open?id=XYZ789"), "XYZ789");
});

test("driveFileId: returns null for non-drive urls", () => {
  assert.equal(driveFileId("https://example.com/page"), null);
  assert.equal(driveFileId(""), null);
});

test("driveFileId: handles encoded ids", () => {
  assert.equal(driveFileId("https://drive.google.com/file/d/a%2Bb%2Fc/view"), "a+b/c");
});

// ---------------------------------------------------------------------------
// formatDuration (from captures page)
// ---------------------------------------------------------------------------
function formatDuration(sec) {
  if (!sec || isNaN(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

test("formatDuration: formats seconds", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(7), "0:07");
  assert.equal(formatDuration(59), "0:59");
  assert.equal(formatDuration(60), "1:00");
  assert.equal(formatDuration(83), "1:23");
  assert.equal(formatDuration(600), "10:00");
});

test("formatDuration: guards invalid input", () => {
  assert.equal(formatDuration(null), "0:00");
  assert.equal(formatDuration(undefined), "0:00");
  assert.equal(formatDuration(NaN), "0:00");
});

// ---------------------------------------------------------------------------
// Redaction (from editor.js) — privacy feature
// ---------------------------------------------------------------------------
function redactSensitiveData(str) {
  if (!str) return str;
  return str
    .replace(/(Bearer\s+)[A-Za-z0-9\-\._~+\/]+/gi, "$1***REDACTED***")
    .replace(/(password|secret|token|api_key|apikey)(["'=:\s]+)[^\s&"',]+/gi, "$1$2***REDACTED***");
}

test("redact: masks Bearer tokens", () => {
  const out = redactSensitiveData("Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc");
  assert.ok(out.includes("***REDACTED***"), "token must be masked");
  assert.ok(!out.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc"), "raw token must be gone");
});

test("redact: masks password= values", () => {
  const out = redactSensitiveData("https://api.example.com/login?password=sup3rsecret&x=1");
  assert.ok(out.includes("***REDACTED***"));
  assert.ok(!out.includes("sup3rsecret"));
});

test("redact: masks secret and token keys", () => {
  assert.ok(!redactSensitiveData('"secret": "abc123"').includes("abc123"));
  assert.ok(!redactSensitiveData("token=xyz789").includes("xyz789"));
  assert.ok(!redactSensitiveData("api_key: 123456").includes("123456"));
});

test("redact: leaves normal text untouched", () => {
  const s = "User clicked the save button successfully";
  assert.equal(redactSensitiveData(s), s);
});

// ---------------------------------------------------------------------------
// Comment timestamp parsing (from Comments.tsx)
// ---------------------------------------------------------------------------
function parseTimestamp(input) {
  const m = input.trim().match(/^(?:(\d+):)?([0-5]?\d)$/);
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  return minutes * 60 + parseInt(m[2], 10);
}

test("parseTimestamp: parses m:ss and plain seconds", () => {
  // Regex accepts m:ss or 0-59 seconds only (e.g. "7", "23").
  assert.equal(parseTimestamp("7"), 7);
  assert.equal(parseTimestamp("1:23"), 83);
  assert.equal(parseTimestamp("0:07"), 7);
  assert.equal(parseTimestamp("10:00"), 600);
});

test("parseTimestamp: rejects invalid", () => {
  assert.equal(parseTimestamp("83"), null); // 83 seconds must be written as 1:23
  assert.equal(parseTimestamp("1:99"), null);
  assert.equal(parseTimestamp("abc"), null);
  assert.equal(parseTimestamp(""), null);
  assert.equal(parseTimestamp("12:34:56"), null);
});

// ---------------------------------------------------------------------------
// expiryToOption (from captures EditModal)
// ---------------------------------------------------------------------------
function expiryToOption(expiresAt, createdAt) {
  if (!expiresAt) return "never";
  const diffMs = new Date(expiresAt).getTime() - new Date(createdAt).getTime();
  if (diffMs <= 36 * 60 * 60 * 1000) return "24h";
  if (diffMs <= 10.5 * 24 * 60 * 60 * 1000) return "7d";
  return "never";
}

test("expiryToOption: classifies expiry windows", () => {
  const now = new Date().toISOString();
  assert.equal(expiryToOption(null, now), "never");
  assert.equal(
    expiryToOption(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), now),
    "24h"
  );
  assert.equal(
    expiryToOption(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), now),
    "7d"
  );
  assert.equal(
    expiryToOption(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), now),
    "never"
  );
});
