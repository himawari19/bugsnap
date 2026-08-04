-- Google Drive OAuth credentials, exact capture IDs, and deletion audit.
-- Apply through the normal migration workflow; never paste secrets into this file.

alter table public.captures add column if not exists drive_file_id text;
update public.captures
set drive_file_id = coalesce(
  substring(drive_url from '[?&]id=([A-Za-z0-9_-]{10,200})'),
  substring(drive_url from '/d/([A-Za-z0-9_-]{10,200})')
)
where drive_file_id is null and drive_url is not null;
create index if not exists captures_drive_file_id_idx on public.captures(drive_file_id);

create table if not exists public.google_drive_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  google_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.google_drive_oauth_states (
  nonce_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.capture_delete_audit (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null,
  capture_id uuid not null,
  workspace_id uuid,
  user_id uuid not null references auth.users(id),
  mode text not null check (mode in ('drive_trash','mazway_only')),
  outcome text not null check (outcome in ('deleted','failed','already_deleted')),
  drive_file_id text,
  error text,
  created_at timestamptz not null default now(),
  unique(operation_id, capture_id)
);

create or replace function public.delete_capture_with_audit(
  p_operation_id uuid,
  p_capture_id uuid,
  p_user_id uuid,
  p_mode text,
  p_drive_file_id text default null
)
returns table(capture_id uuid, outcome text, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.capture_delete_audit%rowtype;
  target public.captures%rowtype;
begin
  if p_mode not in ('drive_trash', 'mazway_only') then
    raise exception 'Invalid deletion mode';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text || ':' || p_capture_id::text, 0));

  select * into existing
  from public.capture_delete_audit audit
  where audit.operation_id = p_operation_id and audit.capture_id = p_capture_id;
  if found then
    return query select existing.capture_id, existing.outcome, existing.error;
    return;
  end if;

  select captures.* into target
  from public.captures captures
  join public.workspaces workspaces on workspaces.id = captures.workspace_id
  where captures.id = p_capture_id and workspaces.owner_user_id = p_user_id
  for update of captures;

  if not found then
    insert into public.capture_delete_audit(operation_id, capture_id, user_id, mode, outcome, drive_file_id, error)
    values (p_operation_id, p_capture_id, p_user_id, p_mode, 'failed', p_drive_file_id, 'Not found or not owned')
    returning capture_delete_audit.capture_id, capture_delete_audit.outcome, capture_delete_audit.error
    into capture_id, outcome, error;
    return next;
    return;
  end if;

  delete from public.captures where id = target.id;
  if not found then
    raise exception 'Capture deletion affected no rows';
  end if;

  insert into public.capture_delete_audit(operation_id, capture_id, workspace_id, user_id, mode, outcome, drive_file_id)
  values (p_operation_id, p_capture_id, target.workspace_id, p_user_id, p_mode, 'deleted', p_drive_file_id)
  returning capture_delete_audit.capture_id, capture_delete_audit.outcome, capture_delete_audit.error
  into capture_id, outcome, error;
  return next;
end;
$$;

alter function public.delete_capture_with_audit(uuid, uuid, uuid, text, text) owner to postgres;
revoke all on function public.delete_capture_with_audit(uuid, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.delete_capture_with_audit(uuid, uuid, uuid, text, text) to service_role;

alter table public.google_drive_connections enable row level security;
alter table public.google_drive_oauth_states enable row level security;
alter table public.capture_delete_audit enable row level security;
revoke all on public.google_drive_connections, public.google_drive_oauth_states, public.capture_delete_audit from anon, authenticated;
