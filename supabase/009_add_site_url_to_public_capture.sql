-- =====================================================================
-- 009_add_site_url_to_public_capture.sql — Add site_url to public capture view
--
-- HOW TO APPLY:
--   Paste in Supabase SQL Editor and Run. Re-runnable (idempotent).
-- =====================================================================

drop function if exists public.get_public_capture(uuid, text) cascade;

create or replace function public.get_public_capture(p_id uuid, p_password text)
returns table (
  id uuid,
  title text,
  type text,
  drive_url text,
  site_url text,
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
      null::uuid, null::text, null::text, null::text, null::text, null::timestamptz,
      null::text, null::text, null::jsonb, null::text, null::text,
      null::boolean, null::text[], null::text[], 'not_found'::text;
    return;
  end if;

  -- Check View Count (for burn after read)
  select count(*) into v_view_count from public.capture_views cv where cv.capture_id = p_id;

  -- Enforce burn after read (if already viewed at least once, treat as expired)
  if v_rec.burn_after_read = true and v_view_count > 0 then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'expired'::text;
    return;
  end if;

  -- Enforce Expiry
  if v_rec.expires_at is not null and v_rec.expires_at < now() then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'expired'::text;
    return;
  end if;

  -- Enforce IP restriction (if whitelist is set, client IP must be present in it)
  if v_rec.allowed_ips is not null and card_identity(v_rec.allowed_ips) > 0 then
    if v_client_ip = '' or not (v_rec.allowed_ips @> array[v_client_ip]) then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'unauthorized_ip'::text;
      return;
    end if;
  end if;

  -- Enforce Domain Whitelist (if allowed_domains set, client email domain must match)
  if v_rec.allowed_domains is not null and card_identity(v_rec.allowed_domains) > 0 then
    if v_client_email = '' then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'needs_login'::text;
      return;
    elsif not (v_rec.allowed_domains @> array[v_client_domain]) then
      return query select
        v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
        v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
        v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'unauthorized_domain'::text;
      return;
    end if;
  end if;

  -- Enforce Password Protection
  if v_rec.password is not null and (p_password is null or p_password <> v_rec.password) then
    return query select
      v_rec.id, v_rec.title, v_rec.type, null::text, v_rec.site_url, v_rec.created_at,
      v_rec.window_size, v_rec.description, null::jsonb, v_rec.os, v_rec.browser,
      v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'needs_password'::text;
    return;
  end if;

  -- Log this access in audit_logs
  insert into public.audit_logs (capture_id, user_id, action, ip, viewer_email)
    values (p_id, auth.uid(), 'view', v_client_ip, nullif(v_client_email, ''));

  -- Success path
  return query select
    v_rec.id, v_rec.title, v_rec.type, v_rec.drive_url, v_rec.site_url, v_rec.created_at,
    v_rec.window_size, v_rec.description, v_rec.dev_logs, v_rec.os, v_rec.browser,
    v_rec.burn_after_read, v_rec.allowed_domains, v_rec.allowed_ips, 'ok'::text;
end;
$$;

grant execute on function public.get_public_capture(uuid, text) to anon, authenticated;
