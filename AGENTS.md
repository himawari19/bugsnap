# AGENTS.md — Agent Guidelines & Project Rules

> This file is the single source of truth for AI agents and developers working on the **BugSnap** codebase.

## System & Tool Rules (CRITICAL)

1. **Do NOT call legacy, nonexistent tools** such as `Bash_ide` or `Agent_ide`. Always use the officially declared tools: `Bash` (capital B) for shell commands and `Agent` (capital A) for creating subagents. Usage of `Bash_ide` or `Agent_ide` will fail with "Tool not found".
2. **Do NOT use shell command `cat`** to read files. Always use the dedicated `Read` tool (which handles line numbers, pagination, and caching correctly).
3. **NEVER run `git push`** unless the user explicitly asks in that exact turn.

## Versioning (SemVer — bump before every production deploy)

- **Semantic Versioning**: `MAJOR.MINOR.PATCH`. Bump is REQUIRED whenever this work is about to ship to production.
  - **MAJOR**: breaking change (API schema break, breaking auth, breaking UI flow). E.g. `0.2.0` → `1.0.0`.
  - **MINOR**: new user-facing feature (new route, new module, new integration). E.g. `0.1.0` → `0.2.0`.
  - **PATCH**: bugfix, hotfix, rebrand/copy, dependency bump. E.g. `0.2.0` → `0.2.1`.
- The more updates in a release, the higher the segment you bump — a batch with one new feature = MINOR; a batch with feature + several fixes = MINOR (or skip PATCH increment). Never ship a prod deploy without a version increase that reflects the size of the change.
- Version lives in `package.json` (+ sync `package-lock.json` top-level `version` and `packages[""].version`).
- This applies to both repos: web dashboard here and `bugsnapextension` in `manifest.json` (extension's real release version).

## Project Overview

BugSnap is a screen-recorder + bug-reporting SaaS (like Jam.dev / Loom):

- **`bugsnap-extension/`** — Chrome MV3 extension. Captures screenshots/recordings, annotates in a canvas editor, uploads to Google Drive, and registers metadata in Supabase.
- **`bugsnap-dashboard/`** — Next.js 14 (App Router) web app. Login via Google OAuth (Supabase), analytics dashboard, captures library, public share pages, comments, AI bug reports, workspace/team management.

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

### Dashboard (`bugsnap-dashboard/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, bypasses RLS (comment notification route)
# Optional:
CUSTOM_ROUTER_API_KEY=... # custom AI proxy (highest priority, model "combo")
OPENROUTER_API_KEY=...    # enables real AI bug reports via OpenRouter (deepseek/deepseek-chat:free)
OPENAI_API_KEY=...        # fallback AI provider (gpt-4o-mini) if others are not set
RESEND_API_KEY=...        # enables weekly digest + comment/mention emails
RESEND_FROM_EMAIL=...     # sender for all outgoing emails
CRON_SECRET=...           # guards /api/weekly-digest
NEXT_PUBLIC_APP_URL=...   # canonical app URL, used for share links + email links
SUPER_ADMIN_EMAILS=...    # comma-separated list of emails allowed to view /admin dashboard
```

### Extension (`bugsnap-extension/editor.js` top `CONFIG`)
```js
const CONFIG = {
  supabaseUrl: 'https://<ref>.supabase.co',
  supabaseAnonKey: 'eyJ...',
  prodUrl: 'https://bugsnap.vercel.app', // ← change when deploying to custom domain
  localUrl: 'http://localhost:3000',
};
```
`resolveDashboardUrl()` auto-selects local vs prod based on the active tab URL.

## Testing

- Dashboard: `npm run build` in `bugsnap-dashboard` MUST pass clean (eslint + types) before any change is considered done.
- Extension: `node --check editor.js` (syntax only). Manual test in Chrome via `chrome://extensions` → Reload.
- SQL changes: apply via Supabase SQL Editor or Management API (PAT `sbp_*`), then verify with `pg_policies`/`pg_proc` queries.
- Never assume the DB matches the repo SQL files — always verify against live DB first (tables/functions/policies).

## Next Development Ideas (pick 1, don't repeat past choices)

> Pick any ONE of these as the next feature. Once picked, it's off the table — never propose the same idea twice.

1. **Auto-Record Rules Engine** — extension auto-starts a recording when a configurable trigger fires (console error of a certain type, URL pattern match, network failure). Useful for reproducing intermittent bugs without a tester present. Touches: `content.js` (triggers), `background.js` (recording start), `options.html` (rules UI), Supabase `user_rules` table.

2. **AI Auto-Triage** — after a capture is uploaded, AI classifies it (severity: critical/major/minor; category: layout/JS/runtime) and assigns it to a workspace member by role/skill. Touches: new `/api/ai-triage` route (reuse OpenRouter fallback), `captures.triage` JSONB column, dashboard badge + filter.

3. **Capture Analytics Export** — workspace-level CSV/JSON export of captures (title, type, date, views, comments count, status) + a simple shareable "workspace stats" public page. Touches: `/api/export` route, `workspaces` stats view, settings button.

4. **Dark Mode for Share Pages** — theme toggle on `/c/[id]` public page (and dashboard), persisted in localStorage, respects `prefers-color-scheme`. Touches: Tailwind `dark:` tokens, `I18nProvider`-style theme provider, share page shell.

5. **Interactive Onboarding Tour** — 4-5 step guided walkthrough for first-time users (install extension → make first capture → share link → invite teammate), driven by a lightweight tour component + `onboarding_seen` flag on `users`. Touches: new `src/components/OnboardingTour.tsx`, `/dashboard` mount point, `users` column.
