export type DeleteAuditResult = { capture_id: string; outcome: string; error: string | null };
export type DeleteReconciliationDecision =
  | { action: "replay"; result: ReturnType<typeof resultFromAudit> }
  | { action: "compensate" }
  | { action: "reconcile" };

export function decideDeleteReconciliation(audit: DeleteAuditResult | null, lookupFailed: boolean): DeleteReconciliationDecision {
  if (lookupFailed) return { action: "reconcile" };
  if (audit && audit.outcome !== "failed") return { action: "replay", result: resultFromAudit(audit) };
  return { action: "compensate" };
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function parseDriveFileId(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "drive.google.com" && parsed.hostname !== "docs.google.com") return null;
    const id = parsed.searchParams.get("id") ?? parsed.pathname.match(/\/d\/([^/]+)/)?.[1] ?? null;
    return id && /^[A-Za-z0-9_-]{10,200}$/.test(id) ? id : null;
  } catch { return null; }
}

export function resultFromAudit(row: DeleteAuditResult) {
  return { captureId: row.capture_id, ok: row.outcome !== "failed", outcome: row.outcome, ...(row.error ? { error: row.error } : {}) };
}

export function compensatedDeleteError(deleteError: unknown, compensationError?: unknown) {
  const message = deleteError instanceof Error ? deleteError.message : "Delete failed";
  if (!compensationError) return `${message}. The Google Drive file was restored`;
  const compensation = compensationError instanceof Error ? compensationError.message : "restore failed";
  return `${message}. Google Drive restore also failed: ${compensation}`;
}
