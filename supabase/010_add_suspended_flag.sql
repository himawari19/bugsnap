-- =====================================================================
-- 010_add_suspended_flag.sql — add suspended flag to public.users
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Idempotent.
--
-- Purpose: lets the super-admin mark a user as suspended from the
-- Super Admin dashboard. The (app) layout checks this flag and blocks
-- the user's access (screens + capture quota).
-- =====================================================================

alter table public.users
  add column if not exists suspended boolean not null default false;