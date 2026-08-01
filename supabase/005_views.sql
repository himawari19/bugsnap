-- =====================================================================
-- 005_views.sql — capture view tracking
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Re-runnable (idempotent).
--
-- Public share pages (/c/:id) are viewed by anonymous users, so
-- record_view is SECURITY DEFINER (runs as the table owner and bypasses
-- RLS) and is granted to anon. get_view_count powers the small
-- "N views" badge on the share page and is callable by anon/authenticated.
-- =====================================================================

create table if not exists public.capture_views (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.captures(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  viewer_ref text  -- coarse referrer/source, optional
);

create index if not exists capture_views_capture_idx on public.capture_views(capture_id);

alter table public.capture_views enable row level security;

-- Defence-in-depth: anon + authenticated may insert (coarse public stats;
-- record_view is SECURITY DEFINER anyway) and select (for counting).
-- No client update/delete.
drop policy if exists "capture_views public insert" on public.capture_views;
drop policy if exists "capture_views public select" on public.capture_views;

create policy "capture_views public insert" on public.capture_views
  for insert to anon, authenticated
  with check (true);

create policy "capture_views public select" on public.capture_views
  for select to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------
-- RPC: record a view. SECURITY DEFINER so anonymous public viewers can
-- insert. The FK on capture_id already rejects unknown ids.
-- ---------------------------------------------------------------------
create or replace function public.record_view(p_capture_id uuid, p_ref text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.capture_views (capture_id, viewer_ref)
  values (p_capture_id, p_ref);
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: count views for a capture.
-- ---------------------------------------------------------------------
create or replace function public.get_view_count(p_capture_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.capture_views
  where capture_id = p_capture_id;
$$;

grant execute on function public.record_view(uuid, text) to anon, authenticated;
grant execute on function public.get_view_count(uuid) to anon, authenticated;
