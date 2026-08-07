-- =====================================================================
-- 011_app_settings.sql — Global app settings (Key-Value)
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Idempotent.
--
-- Purpose: Store global platform settings like the promo banner.
-- RLS: Select is public, Insert/Update/Delete is blocked (only service role
-- via admin API can modify).
-- =====================================================================

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read" on public.app_settings
  for select using (true);
