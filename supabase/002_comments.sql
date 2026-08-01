-- =====================================================================
-- 002_comments.sql — Time-stamped comments for captures
--
-- HOW TO APPLY:
--   Run this against your Supabase project once (SQL Editor, or
--   `supabase db push` if you use the CLI / migrations). It is
--   idempotent: re-running is safe.
--
--   If 001_*.sql exists as a prior migration, keep the numbering so
--   `supabase db push` applies them in order.
--
-- Notes:
--   * `video_timestamp` is seconds into the recording; NULL for
--     screenshots / non-timestamped comments.
--   * RLS is open-read and insert for authenticated users, plus an
--     optional anon insert policy so public share-page viewers can
--     comment too. Remove the anon policy if you don't want that.
-- =====================================================================

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid not null references public.captures(id) on delete cascade,
  author_name text,
  author_email text,
  body text not null,
  video_timestamp integer,  -- seconds into the video; null for screenshots / non-timestamped
  created_at timestamptz not null default now()
);

create index if not exists comments_capture_id_created_at_idx
  on public.comments (capture_id, created_at asc);

-- RLS:
alter table public.comments enable row level security;

create policy "comments read" on public.comments for select using (true);

create policy "comments insert auth" on public.comments for insert
  to authenticated with check (true);

-- (optional) allow anon insert so public viewers can comment too:
create policy "comments insert anon" on public.comments for insert
  to anon with check (true);
