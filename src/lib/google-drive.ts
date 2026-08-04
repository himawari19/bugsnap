import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { createServiceClient } from "@/lib/supabase-server";
export { isUuid, parseDriveFileId } from "@/lib/google-drive-values";
import { isUuid } from "@/lib/google-drive-values";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const DRIVE_FILES = "https://www.googleapis.com/drive/v3/files";
const STATE_TTL_MS = 10 * 60_000;

type State = { userId: string; nonce: string; exp: number };
type Connection = { user_id: string; refresh_token: string; google_email: string | null };

function env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function key() {
  return createHash("sha256").update(env("GOOGLE_DRIVE_ENCRYPTION_KEY"), "utf8").digest();
}

export function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function decrypt(value: string) {
  const data = Buffer.from(value, "base64url");
  if (data.length < 29) throw new Error("Invalid encrypted value");
  const decipher = createDecipheriv("aes-256-gcm", key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString("utf8");
}

export async function authenticatedUser(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  const { data: { user }, error } = await createServiceClient().auth.getUser(token);
  return error ? null : user;
}

export async function createConnectUrl(userId: string) {
  const db = createServiceClient();
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + STATE_TTL_MS).toISOString();
  const { error } = await db.from("google_drive_oauth_states").insert({ nonce_hash: createHash("sha256").update(nonce).digest("hex"), user_id: userId, expires_at: expiresAt });
  if (error) throw error;
  const state = encrypt(JSON.stringify({ userId, nonce, exp: Date.now() + STATE_TTL_MS } satisfies State));
  const params = new URLSearchParams({ client_id: env("GOOGLE_DRIVE_CLIENT_ID"), redirect_uri: env("GOOGLE_DRIVE_REDIRECT_URI"), response_type: "code", scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/userinfo.email", access_type: "offline", prompt: "consent", state });
  return `${GOOGLE_AUTH}?${params}`;
}

export async function consumeState(value: string) {
  const state = JSON.parse(decrypt(value)) as State;
  if (!isUuid(state.userId) || typeof state.nonce !== "string" || !state.nonce || typeof state.exp !== "number" || state.exp < Date.now()) throw new Error("OAuth state expired");
  const db = createServiceClient();
  const nonceHash = createHash("sha256").update(state.nonce).digest("hex");
  const { data, error } = await db.from("google_drive_oauth_states").delete().eq("nonce_hash", nonceHash).eq("user_id", state.userId).gt("expires_at", new Date().toISOString()).select("user_id").maybeSingle();
  if (error || !data) throw new Error("OAuth state is invalid or already used");
  return state.userId;
}

async function tokenRequest(params: Record<string, string>) {
  const response = await fetch(GOOGLE_TOKEN, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: env("GOOGLE_DRIVE_CLIENT_ID"), client_secret: env("GOOGLE_DRIVE_CLIENT_SECRET"), ...params }), cache: "no-store" });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== "string") throw new Error("Google token exchange failed");
  return body as { access_token: string; refresh_token?: string; expires_in?: number };
}

export async function finishConnection(userId: string, code: string) {
  const tokens = await tokenRequest({ code, redirect_uri: env("GOOGLE_DRIVE_REDIRECT_URI"), grant_type: "authorization_code" });
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token");
  const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokens.access_token}` }, cache: "no-store" });
  const profile = info.ok ? await info.json() as { email?: string } : {};
  const { error } = await createServiceClient().from("google_drive_connections").upsert({ user_id: userId, refresh_token: encrypt(tokens.refresh_token), google_email: profile.email ?? null, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function driveAccessToken(userId: string) {
  const { data, error } = await createServiceClient().from("google_drive_connections").select("user_id,refresh_token,google_email").eq("user_id", userId).maybeSingle();
  if (error || !data) throw new Error("Google Drive is not connected");
  const connection = data as Connection;
  const tokens = await tokenRequest({ refresh_token: decrypt(connection.refresh_token), grant_type: "refresh_token" });
  return tokens.access_token;
}

async function setDriveFileTrashed(accessToken: string, fileId: string, trashed: boolean) {
  const response = await fetch(`${DRIVE_FILES}/${encodeURIComponent(fileId)}?supportsAllDrives=true`, { method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ trashed }), cache: "no-store" });
  if (response.ok || (trashed && response.status === 404)) return;
  throw new Error(`Google Drive rejected ${trashed ? "trash" : "restore"} request (${response.status})`);
}

export function trashDriveFile(accessToken: string, fileId: string) {
  return setDriveFileTrashed(accessToken, fileId, true);
}

export function untrashDriveFile(accessToken: string, fileId: string) {
  return setDriveFileTrashed(accessToken, fileId, false);
}
