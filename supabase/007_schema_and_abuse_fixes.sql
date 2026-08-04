-- Forward repair: comments, folders/settings, and public RPC abuse controls.

-- Comments: threads and timestamps are constrained at the database boundary.
alter table public.comments add column if not exists parent_id uuid references public.comments(id) on delete cascade;
alter table public.comments drop constraint if exists comments_video_timestamp_check;
alter table public.comments add constraint comments_video_timestamp_check
  check (video_timestamp is null or video_timestamp between 0 and 86400);
alter table public.comments drop constraint if exists comments_body_length_check;
alter table public.comments add constraint comments_body_length_check check (char_length(btrim(body)) between 1 and 5000);
create index if not exists comments_parent_id_idx on public.comments(parent_id);

-- Prevent public SELECT * from exposing author_email and bypassing the RPC spam guard.
drop policy if exists "comments insert auth" on public.comments;
drop policy if exists "comments insert anon" on public.comments;
revoke insert on public.comments from anon, authenticated;
revoke select on public.comments from anon, authenticated;
grant select (id, capture_id, author_name, body, video_timestamp, created_at, parent_id)
  on public.comments to anon, authenticated;

-- Replace the old overload so PostgREST has one unambiguous function.
drop function if exists public.post_comment(uuid, text, text, text, text);
create or replace function public.post_comment(
  p_capture_id uuid,
  p_visitor_ref text,
  p_body text,
  p_author_name text default null,
  p_author_email text default null,
  p_parent_id uuid default null,
  p_video_timestamp integer default null
)
returns public.comments
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_comment public.comments;
  v_ip text := btrim(split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1));
  v_key text;
  v_count integer;
begin
  if p_body is null or char_length(btrim(p_body)) not between 1 and 5000 then
    raise exception 'Comment body must contain 1 to 5000 characters' using errcode = '23502';
  end if;
  if p_video_timestamp is not null and p_video_timestamp not between 0 and 86400 then
    raise exception 'Invalid video timestamp' using errcode = '22003';
  end if;
  if not exists (select 1 from public.captures where id = p_capture_id) then
    raise exception 'Capture not found' using errcode = 'P0002';
  end if;
  if p_parent_id is not null and not exists (
    select 1 from public.comments where id = p_parent_id and capture_id = p_capture_id and parent_id is null
  ) then
    raise exception 'Invalid parent comment' using errcode = '23503';
  end if;

  -- The platform-provided address is authoritative; visitor_ref is only a fallback.
  v_key := encode(extensions.digest(coalesce(nullif(v_ip, ''), nullif(left(p_visitor_ref, 128), ''), 'unknown'), 'sha256'), 'hex');
  insert into public.comment_spam_guard(ip, last_post_at, post_count)
  values (v_key, now(), 1)
  on conflict (ip) do update set
    post_count = case when comment_spam_guard.last_post_at > now() - interval '10 minutes'
                      then comment_spam_guard.post_count + 1 else 1 end,
    last_post_at = now()
  returning post_count into v_count;
  if v_count > 5 then
    raise exception 'Too many comments. Please wait 10 minutes.' using errcode = 'P0001';
  end if;

  insert into public.comments(capture_id, author_name, author_email, body, video_timestamp, parent_id)
  values (p_capture_id, left(coalesce(nullif(btrim(p_author_name), ''), 'Visitor'), 200),
          nullif(left(btrim(p_author_email), 320), ''), btrim(p_body), p_video_timestamp, p_parent_id)
  returning * into v_comment;
  return v_comment;
end;
$$;
revoke all on function public.post_comment(uuid,text,text,text,text,uuid,integer) from public;
grant execute on function public.post_comment(uuid,text,text,text,text,uuid,integer) to anon, authenticated;

-- Folder and settings schema used by the dashboard.
alter table public.captures add column if not exists folder_name text;
create table if not exists public.workspace_folders (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 200),
  created_at timestamptz not null default now(),
  unique(workspace_id, name)
);
create table if not exists public.workspace_settings (
  workspace_id uuid primary key references public.workspaces(id) on delete cascade,
  webhook_url text not null default '', brand_name text not null default 'mazway',
  custom_logo_url text not null default '', hide_watermark boolean not null default false,
  custom_domain text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.deleted_drive_folders (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null,
  folder_name text not null, drive_url text, created_at timestamptz not null default now()
);
alter table public.workspace_folders enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.deleted_drive_folders enable row level security;
create policy "workspace folders members select" on public.workspace_folders for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=workspace_folders.workspace_id and m.user_id=auth.uid()));
create policy "workspace folders owners write" on public.workspace_folders for all to authenticated using (
  exists(select 1 from public.workspaces w where w.id=workspace_folders.workspace_id and w.owner_user_id=auth.uid())) with check (
  exists(select 1 from public.workspaces w where w.id=workspace_folders.workspace_id and w.owner_user_id=auth.uid()));
create policy "workspace settings members select" on public.workspace_settings for select to authenticated using (
  exists(select 1 from public.workspace_members m where m.workspace_id=workspace_settings.workspace_id and m.user_id=auth.uid()));
create policy "workspace settings owners write" on public.workspace_settings for all to authenticated using (
  exists(select 1 from public.workspaces w where w.id=workspace_settings.workspace_id and w.owner_user_id=auth.uid())) with check (
  exists(select 1 from public.workspaces w where w.id=workspace_settings.workspace_id and w.owner_user_id=auth.uid()));

create or replace function public.rename_workspace_folder(p_workspace_id uuid, p_old_name text, p_new_name text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if char_length(btrim(p_new_name)) not between 1 and 200 or not exists
    (select 1 from public.workspaces where id=p_workspace_id and owner_user_id=auth.uid()) then
    raise exception 'Invalid folder or permission denied' using errcode='42501';
  end if;
  update public.workspace_folders set name=btrim(p_new_name) where workspace_id=p_workspace_id and name=p_old_name;
  update public.captures set folder_name=btrim(p_new_name) where workspace_id=p_workspace_id and folder_name=p_old_name;
end $$;
create or replace function public.delete_workspace_folder(p_workspace_id uuid, p_folder_name text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.workspaces where id=p_workspace_id and owner_user_id=auth.uid()) then
    raise exception 'Permission denied' using errcode='42501';
  end if;
  insert into public.deleted_drive_folders(workspace_id,folder_name,drive_url)
    select p_workspace_id,p_folder_name,drive_url from public.captures
    where workspace_id=p_workspace_id and folder_name=p_folder_name and drive_url is not null;
  delete from public.captures where workspace_id=p_workspace_id and folder_name=p_folder_name;
  delete from public.workspace_folders where workspace_id=p_workspace_id and name=p_folder_name;
end $$;
revoke all on function public.rename_workspace_folder(uuid,text,text) from public;
revoke all on function public.delete_workspace_folder(uuid,text) from public;
grant execute on function public.rename_workspace_folder(uuid,text,text), public.delete_workspace_folder(uuid,text) to authenticated;

-- View rows are private. One platform address can count once per capture per UTC day.
revoke select, insert on public.capture_views from anon, authenticated;
drop policy if exists "capture_views public insert" on public.capture_views;
drop policy if exists "capture_views public select" on public.capture_views;
alter table public.capture_views add column if not exists viewer_key text;
create unique index if not exists capture_views_dedupe_idx on public.capture_views(capture_id, viewer_key, ((viewed_at at time zone 'UTC')::date));
create or replace function public.record_view(p_capture_id uuid, p_ref text default null)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ip text := btrim(split_part(coalesce(current_setting('request.headers',true)::jsonb->>'x-forwarded-for',''),',',1));
begin
  if not exists(select 1 from public.captures where id=p_capture_id) then return; end if;
  insert into public.capture_views(capture_id,viewer_ref,viewer_key)
  values(p_capture_id,left(p_ref,200),encode(extensions.digest(coalesce(nullif(v_ip,''),nullif(left(p_ref,128),''),'unknown'),'sha256'),'hex'))
  on conflict do nothing;
end $$;
revoke all on function public.record_view(uuid,text) from public;
grant execute on function public.record_view(uuid,text) to anon,authenticated;
