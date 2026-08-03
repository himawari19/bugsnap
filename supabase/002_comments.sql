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

-- ---------------------------------------------------------------------
-- RPC: post a comment from public viewer. Since anon has restricted
-- inserts, this runs as SECURITY DEFINER to bypass table write blocks,
-- while recording author name and reference.
-- ---------------------------------------------------------------------
create or replace function public.post_comment(
  p_capture_id uuid,
  p_visitor_ref text,
  p_body text,
  p_author_name text default null,
  p_author_email text default null
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_comment public.comments;
begin
  -- Validate
  if p_body is null or trim(p_body) = '' then
    raise exception 'Comment body cannot be empty';
  end if;

  insert into public.comments (capture_id, author_name, author_email, body, created_at)
    values (p_capture_id, coalesce(p_author_name, 'Visitor'), p_author_email, p_body, now())
    returning * into v_comment;

  return v_comment;
end;
$$;

grant execute on function public.post_comment(uuid, text, text, text, text) to anon, authenticated;

