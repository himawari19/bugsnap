-- =====================================================================
-- 003_workspaces.sql — Workspaces + members RPCs & RLS
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Re-runnable (idempotent).
--
-- IMPORTANT — existing schema (DO NOT recreate these tables):
--   public.workspaces(id, name, slug, created_at, updated_at, owner_user_id)
--   public.workspace_members(id, workspace_id, user_id, role, joined_at)
--
--   * Note: the owner column is `owner_user_id` (NOT owner_id).
--   * Note: workspace_members has NO invite_email column — members are
--     real users referenced by user_id. Inviting by email resolves to a
--     user_id server-side via invite_member_by_email().
--   * All client access is via the SECURITY DEFINER RPCs below, which run
--     as the postgres owner and therefore bypass RLS. The policies are
--     defence-in-depth for any direct table access.
-- =====================================================================

-- Enable RLS (no-op if already enabled).
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- Defence-in-depth owner-based policies. Drop our own previous attempts
-- first (the existing workspaces_select_policy / members_select_policy
-- are left untouched — multiple SELECT policies are OR-combined).
drop policy if exists "workspaces owner select" on public.workspaces;
drop policy if exists "workspaces owner insert" on public.workspaces;
drop policy if exists "workspaces owner update" on public.workspaces;
drop policy if exists "workspaces owner delete" on public.workspaces;
drop policy if exists "members select own or owner" on public.workspace_members;
drop policy if exists "members owner insert" on public.workspace_members;
drop policy if exists "members owner delete" on public.workspace_members;

create policy "workspaces owner select" on public.workspaces
  for select using (owner_user_id = auth.uid());
create policy "workspaces owner insert" on public.workspaces
  for insert with check (owner_user_id = auth.uid());
create policy "workspaces owner update" on public.workspaces
  for update using (owner_user_id = auth.uid());
create policy "workspaces owner delete" on public.workspaces
  for delete using (owner_user_id = auth.uid());

create policy "members select own or owner" on public.workspace_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );
create policy "members owner insert" on public.workspace_members
  for insert with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );
create policy "members owner delete" on public.workspace_members
  for delete using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- RPC: list the caller's workspaces (owned or a member of), with role
-- and member count. Drives the workspace switcher.
-- ---------------------------------------------------------------------
create or replace function public.get_my_workspaces()
returns table (
  id uuid,
  name text,
  slug text,
  owner_user_id uuid,
  created_at timestamptz,
  role text,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    w.id, w.name, w.slug, w.owner_user_id, w.created_at,
    coalesce(
      (select m.role from public.workspace_members m
       where m.workspace_id = w.id and m.user_id = auth.uid() limit 1),
      'owner'
    ) as role,
    (select count(*) from public.workspace_members m2
     where m2.workspace_id = w.id) as member_count
  from public.workspaces w
  where w.owner_user_id = auth.uid()
     or exists (
       select 1 from public.workspace_members m3
       where m3.workspace_id = w.id and m3.user_id = auth.uid()
     )
  order by w.created_at asc;
$$;

-- ---------------------------------------------------------------------
-- RPC: create a workspace owned by the caller + insert their owner
-- membership row. Handles the NOT NULL slug/updated_at columns
-- server-side so the client doesn't have to guess defaults.
-- ---------------------------------------------------------------------
create or replace function public.create_workspace(p_name text)
returns table (id uuid, name text, slug text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_slug text;
begin
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'))
            || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
  insert into public.workspaces (name, slug, owner_user_id, created_at, updated_at)
    values (p_name, v_slug, auth.uid(), now(), now())
    returning id into v_id;
  insert into public.workspace_members (workspace_id, user_id, role, joined_at)
    values (v_id, auth.uid(), 'owner', now());
  return query select v_id, p_name, v_slug;
end;
$$;

-- ---------------------------------------------------------------------
-- RPC: list members of a workspace with their email (joined to
-- auth.users, which is not client-readable). Only the owner or an
-- existing member may call this.
-- ---------------------------------------------------------------------
create or replace function public.get_workspace_members(p_workspace_id uuid)
returns table (user_id uuid, email text, role text)
language sql
security definer
set search_path = public
as $$
  select m.user_id, u.email, m.role
  from public.workspace_members m
  join auth.users u on u.id = m.user_id
  where m.workspace_id = p_workspace_id
    and (
      exists (
        select 1 from public.workspaces w
        where w.id = p_workspace_id and w.owner_user_id = auth.uid()
      )
      or auth.uid() in (
        select wm.user_id from public.workspace_members wm
        where wm.workspace_id = p_workspace_id
      )
    )
  order by m.joined_at asc;
$$;

-- ---------------------------------------------------------------------
-- RPC: invite a user by email. Since workspace_members references real
-- users by user_id (no invite_email column), this resolves the email to
-- a user_id via auth.users. Raises a clear error if they haven't signed
-- up yet. Only the workspace owner may invite.
-- ---------------------------------------------------------------------
create or replace function public.invite_member_by_email(p_workspace_id uuid, p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
begin
  if not exists (
    select 1 from public.workspaces w
    where w.id = p_workspace_id and w.owner_user_id = auth.uid()
  ) then
    raise exception 'You are not the owner of this workspace';
  end if;

  select id into v_user_id from auth.users where lower(email) = lower(p_email);
  if v_user_id is null then
    raise exception 'No user found with that email. Ask them to sign up to Mazway first.';
  end if;

  if exists (
    select 1 from public.workspace_members
    where workspace_id = p_workspace_id and user_id = v_user_id
  ) then
    return;  -- already a member, nothing to do
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, joined_at)
    values (p_workspace_id, v_user_id, 'member', now());
end;
$$;

grant execute on function public.get_my_workspaces() to authenticated;
grant execute on function public.create_workspace(text) to authenticated;
grant execute on function public.get_workspace_members(uuid) to authenticated;
grant execute on function public.invite_member_by_email(uuid, text) to authenticated;
