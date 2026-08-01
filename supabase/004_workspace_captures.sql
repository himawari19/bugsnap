-- =====================================================================
-- 004_workspace_captures.sql — link captures to a workspace
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Re-runnable (idempotent).
--
-- The mazwayScreen extension (see mazwayScreen/schema.sql) already
-- expects a `workspace_id` column on captures. Rows created before this
-- migration have none, so we add it as NULLABLE (`on delete set null` —
-- never force NOT NULL on existing rows) and backfill opportunistically.
--
-- Backfill rule: for each capture with a NULL workspace_id, use the
-- owner's FIRST (oldest) workspace, resolved via captures.user_id ->
-- workspaces.owner_user_id. Guarded on both columns existing so the
-- block is a safe no-op on any schema shape. Null stays where no owner
-- or no workspace resolves.
-- =====================================================================

alter table public.captures
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

create index if not exists captures_workspace_id_idx on public.captures(workspace_id);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'captures' and column_name = 'user_id'
  ) and exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'workspaces' and column_name = 'owner_user_id'
  ) then
    update public.captures c
    set workspace_id = (
      select w.id
      from public.workspaces w
      where w.owner_user_id = c.user_id
      order by w.created_at asc
      limit 1
    )
    where c.workspace_id is null
      and exists (
        select 1 from public.workspaces w
        where w.owner_user_id = c.user_id
      );
  end if;
end;
$$;
