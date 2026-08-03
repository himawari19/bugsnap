-- =====================================================================
-- 006_security_upgrades.sql — Security upgrades and hardening
--
-- HOW TO APPLY:
--   npx supabase db query --linked -f supabase/006_security_upgrades.sql
-- =====================================================================

-- 1. Add security columns to captures table (non-blocking, default safe/off)
alter table public.captures
  add column if not exists burn_after_read boolean default false,
  add column if not exists allowed_domains text[] default null,
  add column if not exists allowed_ips text[] default null;

-- 2. Create comment spam guard table
create table if not exists public.comment_spam_guard (
  ip text primary key,
  last_post_at timestamptz not null default now(),
  post_count integer not null default 1
);

-- 3. Create workspace/capture audit logs table
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  capture_id uuid references public.captures(id) on delete set null,
  user_id uuid, -- auth.users id of viewer, if logged in
  action text not null, -- 'view' | 'delete'
  ip text,
  viewer_email text,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_capture_idx on public.audit_logs(capture_id);

-- Enable RLS on audit_logs
alter table public.audit_logs enable row level security;
create policy "Audit logs viewable by capture owner" on public.audit_logs
  for select
  to authenticated
  using (
    exists (
      select 1 from public.captures c
      join public.workspaces w on w.id = c.workspace_id
      where c.id = capture_id and w.owner_user_id = auth.uid()
    )
  );

-- 4. Re-create get_public_capture to enforce whitelists, IP limits, and burn-after-read
drop function if exists public.get_public_capture(uuid, text) cascade;

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
  burn_after_read boolean,
  allowed_domains text[],
  allowed_ips text[],
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_ip text;
  v_client_email text;
  v_client_domain text;
  v_view_count bigint;
  v_rec record;
begin
  -- Fetch client IP from Supabase request headers
  begin
    v_client_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_client_ip := '';
  end;

  -- Fetch authenticated user email from JWT
  v_client_email := coalesce(auth.jwt() ->> 'email', '');
  v_client_domain := split_part(v_client_email, '@', 2);

  -- Fetch capture row details
  select * into v_rec from public.captures c where c.id = p_id;

  if v_rec.id is null then
    return query select 
      null::uuid, null::text, null::text, null::text, null::timestamptz,
      null::text, null::text, null::jsonb, null::text, null::text,
      null::boolean, null::text[], null::text[], 'not_found'::text;
    return;
  end if;

  -- Check View Count (for burn after read)
  select count(*) into v_view_count from public.capture_views cv where cv.capture_id = p_id;

  -- Enforce burn after read (if already viewed at least once, treat as expired)
  if v_rec.burn_after_read = true and v_view_count > 0 then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'expired'::text;
    return;
  end if;

  -- Enforce Expiry
  if v_rec.expires_at is not null and v_rec.expires_at < now() then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'expired'::text;
    return;
  end if;

  -- Enforce IP restriction (if whitelist is set, client IP must be present in it)
  if v_rec.allowed_ips is not null and card_identity(v_rec.allowed_ips) > 0 then
    if v_client_ip = '' or not (v_rec.allowed_ips @> array[v_client_ip]) then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'unauthorized_ip'::text;
      return;
    end if;
  end if;

  -- Enforce Domain Whitelist (if allowed_domains set, client email domain must match)
  if v_rec.allowed_domains is not null and card_identity(v_rec.allowed_domains) > 0 then
    if v_client_email = '' then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'needs_login'::text;
      return;
    elsif not (v_rec.allowed_domains @> array[v_client_domain]) then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'unauthorized_domain'::text;
      return;
    end if;
  end if;

  -- Enforce Password Protection
  if v_rec.password is not null and (p_password is null or p_password <> v_rec.password) then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'needs_password'::text;
    return;
  end if;

  -- Log this access in audit_logs
  insert into public.audit_logs (capture_id, user_id, action, ip, viewer_email)
    values (p_id, auth.uid(), 'view', v_client_ip, nullif(v_client_email, ''));

  -- Success path
  return query select
    v_rec.id, v_rec.title, v_rec.type, v_rec.drive_url, v_rec.created_at,
    v_rec.window_size, v_rec.description, v_rec.dev_logs, v_rec.os, v_rec.browser,
    v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'ok'::text;
end;
$$;

grant execute on function public.get_public_capture(uuid, text) to anon, authenticated;

-- Helper to check array cardinality easily in plpgsql
create or replace function public.card_identity(arr text[])
returns integer as $$
  select coalesce(array_length(arr, 1), 0);
$$ language sql immutable;


-- 5. Update post_comment to implement rate-limiting spam protection
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
  v_client_ip text;
  v_spam record;
begin
  -- Fetch client IP
  begin
    v_client_ip := split_part(coalesce(current_setting('request.headers', true)::jsonb ->> 'x-forwarded-for', ''), ',', 1);
  exception when others then
    v_client_ip := '127.0.0.1';
  end;

  if v_client_ip is null or v_client_ip = '' then
    v_client_ip := '127.0.0.1';
  end if;

  -- Check Spam limits (limit: max 5 comments in 1 minute per IP)
  select * into v_spam from public.comment_spam_guard where ip = v_client_ip;
  if v_spam.ip is not null then
    if v_spam.last_post_at > now() - interval '1 minute' then
      if v_spam.post_count >= 5 then
        raise exception 'Spam protection: Too many comments. Please wait 1 minute.' using errcode = 'P0005';
      else
        update public.comment_spam_guard 
          set post_count = post_count + 1, last_post_at = now()
          where ip = v_client_ip;
      end if;
    else
      update public.comment_spam_guard 
        set post_count = 1, last_post_at = now()
        where ip = v_client_ip;
    end if;
  else
    insert into public.comment_spam_guard (ip, last_post_at, post_count)
      values (v_client_ip, now(), 1);
  end if;

  -- Validate comment
  if p_body is null or trim(p_body) = '' then
    raise exception 'Comment body cannot be empty' using errcode = '23502';
  end if;

  insert into public.comments (capture_id, author_name, author_email, body, created_at)
    values (p_capture_id, coalesce(p_author_name, 'Visitor'), p_author_email, p_body, now())
    returning * into v_comment;

  return v_comment;
end;
$$;

grant execute on function public.post_comment(uuid, text, text, text, text) to anon, authenticated;
