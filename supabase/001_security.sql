-- ====================================================================
-- MAZWAY DASHBOARD — SECURITY FIX: password / expiry gate for public
-- share links (/c/:id).
--
-- HOW TO APPLY
--   Option 1: paste into the Supabase SQL Editor
--             https://supabase.com/dashboard/project/_/sql
--   Option 2: from the CLI:  supabase db execute < supabase/001_security.sql
--
--   NOTE: the function must be created by a role that owns the
--   `captures` table (e.g. postgres via the SQL Editor), because
--   SECURITY DEFINER runs as that owner and thus bypasses RLS. The
--   SQL Editor runs as postgres, so a plain paste is fine.
--
-- HOW IT WORKS
--   `get_public_capture(p_id uuid, p_password text)` is a SECURITY
--   DEFINER function that reads the capture row (including the
--   `password` / `expires_at` columns it needs for its check) and
--   returns exactly ONE row with a computed `status`:
--
--     'ok'             -> exists, not expired, and either no password is
--                         set or p_password matches
--     'expired'        -> expires_at is set and now() >= expires_at
--     'needs_password' -> password is set and p_password is null/wrong
--     'not_found'      -> no capture with that id
--
--   The client can NEVER read `password` or `expires_at` — they are
--   NOT in the RETURN column list. For any status other than 'ok',
--   `drive_url` and `dev_logs` are returned as NULL as well, so a
--   locked or expired link leaks nothing but its title/type metadata.
-- ====================================================================

create or replace function public.get_public_capture(p_id uuid, p_password text)
returns table (
  id uuid,
  title text,
  type text,
  drive_url text,
  created_at timestamptz,
  window_size text,
  description text,
  dev_logs jsonb,
  os text,
  browser text,
  status text
)
language sql
security definer
set search_path = public
as $$
  with c as (
    select * from public.captures where id = p_id
  )
  select
    c.id,
    c.title,
    c.type,
    case
      when c.expires_at is not null and c.expires_at < now() then null
      when c.password is not null and (p_password is null or p_password <> c.password) then null
      else c.drive_url
    end as drive_url,
    c.created_at,
    c.window_size,
    c.description,
    case
      when c.expires_at is not null and c.expires_at < now() then null
      when c.password is not null and (p_password is null or p_password <> c.password) then null
      else c.dev_logs
    end as dev_logs,
    c.os,
    c.browser,
    case
      when c.id is null then 'not_found'
      when c.expires_at is not null and c.expires_at < now() then 'expired'
      when c.password is not null and (p_password is null or p_password <> c.password) then 'needs_password'
      else 'ok'
    end as status
  from c;
$$;

-- Public and authenticated roles may call the RPC.
grant execute on function public.get_public_capture(uuid, text) to anon, authenticated;

-- Workspace-based capture policies are installed after workspace_id exists
-- (004_workspace_captures.sql). Keeping them here breaks fresh installs.

-- --------------------------------------------------------------------
-- OPTIONAL HARDENING — direct anon access to the raw columns.
-- Deliberately NOT applied here: other code in this repo
-- (e.g. src/app/api/captures/[id]/route.ts) still reads `captures`
-- directly with the anon key, including the `password` column for its
-- own server-side check. Removing column access would break those
-- routes. Also note: a bare `revoke select (password) on captures from
-- anon` does NOT restrict a role that holds a table-level SELECT grant,
-- so the table grant would have to be dropped first.
--
-- Once all direct reads move behind RPCs, replace anon table SELECT
-- with column-level grants on only the non-secret columns:
--
--   revoke select on public.captures from anon;
--   grant select (id, title, type, drive_url, description, dev_logs,
--                 created_at, window_size, user_id, owner_email)
--   on public.captures to anon;
-- --------------------------------------------------------------------
