# AGENTS.md — Agent Guidelines & Project Rules

> This file is the single source of truth for AI agents and developers working on the **Mazway** codebase.

## System & Tool Rules (CRITICAL)

1. **Do NOT call legacy, nonexistent tools** such as `Bash_ide` or `Agent_ide`. Always use the officially declared tools: `Bash` (capital B) for shell commands and `Agent` (capital A) for creating subagents. Usage of `Bash_ide` or `Agent_ide` will fail with "Tool not found".
2. **Do NOT use shell command `cat`** to read files. Always use the dedicated `Read` tool (which handles line numbers, pagination, and caching correctly).
3. **NEVER run `git push`** unless the user explicitly asks in that exact turn.

## Project Overview

Mazway is a screen-recorder + bug-reporting SaaS (like Jam.dev / Loom):

- **`mazwayScreen/`** — Chrome MV3 extension. Captures screenshots/recordings, annotates in a canvas editor, uploads to Google Drive, and registers metadata in Supabase.
- **`mazway-dashboard/`** — Next.js 14 (App Router) web app. Login via Google OAuth (Supabase), analytics dashboard, captures library, public share pages, comments, AI bug reports, workspace/team management.

## Architecture & Data Flow

```
Extension (capture → Drive upload)
   │  anon key + email (from chrome.storage.local "user_email")
   ▼
   Supabase RPC: insert_capture_by_email(...)   ← SECURITY DEFINER, bypasses RLS
   │
   ▼
   tables: captures, comments, workspaces, workspace_members, workspace_settings, capture_views
   ▲
   Dashboard (Next.js, Supabase client with user session, RLS-scoped reads)
```

### Key bridge: email-link (no Supabase session in extension)
- The extension only has a Google Drive OAuth token + email. It inserts captures via the RPC `insert_capture_by_email` (SECURITY DEFINER), which resolves the user by email and links the capture to their workspace.
- The dashboard user MUST sign in with the same Google email for captures to appear.

## Non-Negotiable Rules

1. **NEVER commit secrets**: `.env.local`, Supabase anon/service keys, Google client secrets, `sbp_*` PATs. All are gitignored.
2. **RLS must stay enforced** — never widen a policy to `true` for tables containing user data (we already hardened `workspace_settings` & `captures_insert`).
3. **Extension has no Supabase session** — always go through RPCs, never direct table inserts from the extension.
4. **Keep the design system**: Tailwind tokens `bg-background`, `text-foreground`, `text-muted`, `border-border`, `bg-subtle`, `bg-indigo-600`, `bg-emerald-400`, white cards. No new color palette without asking.
5. **Never hardcode environment-specific values** in source: use `CONFIG` object in `editor.js` (supabaseUrl, supabaseAnonKey, prodUrl, localUrl) and `process.env` in the dashboard.
6. **Password & expires_at never leave the server** — the public share page goes through `get_public_capture` RPC which nulls sensitive fields when locked/expired.

## DB Schema (public schema)

| Table | Purpose | Notes |
|---|---|---|
| `users` | Profile, extends `auth.users` | FK to auth.users, trigger `handle_new_user` |
| `workspaces` | Team container | Trigger `handle_new_workspace` on signup |
| `workspace_members` | User↔workspace with role | roles: owner/admin/member; unique(workspace_id,user_id) |
| `captures` | Screenshot/video metadata | columns: title,type,drive_url,dev_logs(jsonb),window_size,duration,os,browser,description,password,expires_at,owner_email,workspace_id,user_id,tag,status |
| `comments` | Capture feedback | columns: author_name,author_email,body,video_timestamp,parent_id(threads) |
| `workspace_settings` | Branding + webhooks | webhook_url, custom_logo_url, brand_name, hide_watermark |
| `capture_views` | View tracking | record_view / get_view_count RPCs |

### Key RPCs
- `insert_capture_by_email(...)` — extension bridge (10 args: owner_email,title,type,drive_url,dev_logs,window_size,description,duration,os,browser)
- `get_public_capture(p_id, p_password)` — safe public read (returns status: ok/expired/needs_password/not_found, never leaks password/expires_at)
- `get_my_workspaces()`, `create_workspace(p_name)`, `get_workspace_members(p_workspace_id)`, `invite_member_by_email(p_workspace_id, p_email)`
- `record_view(p_capture_id, p_ref)`, `get_view_count(p_capture_id)`

### RLS summary
- `captures`: select = owner_email matches JWT OR member of workspace; insert = auth.uid()=user_id AND member; update/delete = member of workspace
- `comments`: anyone (public) can select/insert (public feedback)
- `workspace_settings`: members only (hardened)
- `workspaces`/`workspace_members`: member-scoped

## Dashboard Routes (App Router)

| Route | Purpose |
|---|---|
| `/` | Landing + Google sign-in (redirectTo `/dashboard`) |
| `/dashboard` | Analytics overview (stats, weekly chart, recent) |
| `/captures` | All captures grid — infinite scroll (12/page via `.range()`), Type filter, search |
| `/captures/[id]` | Detail view: media preview + `DevToolsPanel` + `Comments` (authenticated) |
| `/c/[id]` | **Public share page**: password gate, expiry, comments, embed, QR, AI bug report |
| `/settings` | Workspace settings (webhook, branding) |
| `/settings/members` | Team management (invite/remove members) |
| `/api/ai-bug-summary` | POST: OpenAI summary (falls back to local parser without key) |
| `/api/weekly-digest` | GET: weekly email digest (guarded by CRON_SECRET) |

## Dev Conventions

- **`useSearchParams` must be wrapped in `<Suspense>`** in client components (Next.js prerender requirement). Layouts should read query params via `window.location` instead.
- **Infinite scroll pattern** in `/captures`: `IntersectionObserver` + `pageRef` + `.range(from,to)` — do not regress to full-table fetches.
- Comments component (`src/components/Comments.tsx`) is shared between `/captures/[id]` and `/c/[id]` — keep it unified.
- `DevToolsPanel.tsx` is shared; dev_logs entries have shape `{type: "console"|"network"|"step", ...}`.
- Add `referrerPolicy="no-referrer"` to any `<img>` loading from Google (`lh3.googleusercontent.com`, Drive thumbnails).

## Env Vars

### Dashboard (`mazway-dashboard/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, bypasses RLS (comment notification route)
# Optional:
OPENROUTER_API_KEY=...    # enables real AI bug reports via OpenRouter (deepseek/deepseek-chat:free) — preferred
OPENAI_API_KEY=...        # fallback AI provider (gpt-4o-mini) if OPENROUTER_API_KEY is not set
RESEND_API_KEY=...        # enables weekly digest + comment/mention emails
RESEND_FROM_EMAIL=...     # sender for all outgoing emails
CRON_SECRET=...           # guards /api/weekly-digest
NEXT_PUBLIC_APP_URL=...   # canonical app URL, used for share links + email links
```

### Extension (`mazwayScreen/editor.js` top `CONFIG`)
```js
const CONFIG = {
  supabaseUrl: 'https://<ref>.supabase.co',
  supabaseAnonKey: 'eyJ...',
  prodUrl: 'https://mazway-dashboard.vercel.app', // ← change when deploying to custom domain
  localUrl: 'http://localhost:3000',
};
```
`resolveDashboardUrl()` auto-selects local vs prod based on the active tab URL.

## Testing

- Dashboard: `npm run build` in `mazway-dashboard` MUST pass clean (eslint + types) before any change is considered done.
- Extension: `node --check editor.js` (syntax only). Manual test in Chrome via `chrome://extensions` → Reload.
- SQL changes: apply via Supabase SQL Editor or Management API (PAT `sbp_*`), then verify with `pg_policies`/`pg_proc` queries.
- Never assume the DB matches the repo SQL files — always verify against live DB first (tables/functions/policies).
