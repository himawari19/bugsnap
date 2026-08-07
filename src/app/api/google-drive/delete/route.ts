import { NextResponse } from "next/server";
import { authenticatedUser, driveAccessToken, trashDriveFile, untrashDriveFile } from "@/lib/google-drive";
import { compensatedDeleteError, decideDeleteReconciliation, isUuid, parseDriveFileId, resultFromAudit, type DeleteAuditResult } from "@/lib/google-drive-values";
import { createServiceClient } from "@/lib/supabase-server";
export const runtime = "nodejs";

type Mode = "drive_trash" | "BugSnap_only";
type Capture = { id: string; workspace_id: string | null; drive_file_id: string | null; drive_url: string | null };
type Result = { captureId: string; ok: boolean; outcome: string; error?: string };

export async function POST(request: Request) {
  const user = await authenticatedUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const input = body as { captureIds?: unknown; mode?: unknown; operationId?: unknown };
  const ids = Array.isArray(input?.captureIds) ? Array.from(new Set(input.captureIds)) : [];
  const mode = input?.mode as Mode;
  const operationId = input?.operationId;
  if (!ids.length || ids.length > 100 || ids.some(id => typeof id !== "string" || !isUuid(id)) || !["drive_trash", "BugSnap_only"].includes(mode) || typeof operationId !== "string" || !isUuid(operationId)) {
    return NextResponse.json({ error: "Provide 1-100 capture UUIDs, a valid mode, and a UUID operationId" }, { status: 400 });
  }

  const db = createServiceClient();
  const { data: audits, error: auditError } = await db.from("capture_delete_audit").select("capture_id,outcome,error").eq("operation_id", operationId).eq("user_id", user.id).in("capture_id", ids as string[]);
  if (auditError) return NextResponse.json({ error: "Could not check deletion status" }, { status: 503 });
  const replayed = new Map((audits as DeleteAuditResult[] | null)?.map(row => [row.capture_id, resultFromAudit(row)]) ?? []);
  const pendingIds = (ids as string[]).filter(id => !replayed.has(id));

  let accessToken: string | null = null;
  if (mode === "drive_trash" && pendingIds.length) {
    try { accessToken = await driveAccessToken(user.id); }
    catch { return NextResponse.json({ error: "Google Drive is not connected" }, { status: 409 }); }
  }

  const results: Result[] = [];
  for (const captureId of ids as string[]) {
    const replay = replayed.get(captureId);
    if (replay) { results.push(replay); continue; }

    let fileId: string | null = null;
    let trashed = false;
    try {
      if (mode === "drive_trash") {
        const { data, error } = await db.from("captures").select("id,workspace_id,drive_file_id,drive_url,workspaces!inner(owner_user_id)").eq("id", captureId).eq("workspaces.owner_user_id", user.id).maybeSingle();
        if (error) throw error;
        const capture = data as Capture | null;
        if (!capture) throw new Error("Not found or not owned");
        fileId = capture.drive_file_id ?? parseDriveFileId(capture.drive_url);
        if (!fileId) throw new Error("Capture has no exact Google Drive file ID");
        await trashDriveFile(accessToken!, fileId);
        trashed = true;
      }

      const { data, error } = await db.rpc("delete_capture_with_audit", {
        p_operation_id: operationId,
        p_capture_id: captureId,
        p_user_id: user.id,
        p_mode: mode,
        p_drive_file_id: fileId,
      }).single();
      if (error || !data) throw error ?? new Error("Delete did not return a result");
      const result = resultFromAudit(data as DeleteAuditResult);
      if (!result.ok && trashed) {
        const deleteError = new Error(result.error ?? "Database deletion failed");
        try { await untrashDriveFile(accessToken!, fileId!); result.error = compensatedDeleteError(deleteError); }
        catch (compensationError) { result.error = compensatedDeleteError(deleteError, compensationError); }
      }
      results.push(result);
    } catch (caught) {
      let message = caught instanceof Error ? caught.message : "Delete failed";
      if (trashed) {
        const { data: audit, error: lookupError } = await db.from("capture_delete_audit").select("capture_id,outcome,error").eq("operation_id", operationId).eq("capture_id", captureId).eq("user_id", user.id).maybeSingle();
        const decision = decideDeleteReconciliation(audit as DeleteAuditResult | null, Boolean(lookupError));
        if (decision.action === "replay") { results.push(decision.result); continue; }
        if (decision.action === "reconcile") {
          results.push({ captureId, ok: false, outcome: "reconciliation_needed", error: "Deletion status could not be confirmed; the Google Drive file remains trashed and reconciliation is required" });
          continue;
        }
        try { await untrashDriveFile(accessToken!, fileId!); message = compensatedDeleteError(caught); }
        catch (compensationError) { message = compensatedDeleteError(caught, compensationError); }
      }
      results.push({ captureId, ok: false, outcome: "failed", error: message.slice(0, 500) });
    }
  }

  return NextResponse.json({ operationId, results, succeeded: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length }, { status: results.some(r => r.ok) ? 200 : 422 });
}
