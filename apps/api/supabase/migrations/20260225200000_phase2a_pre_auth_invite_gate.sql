-- Phase 2A: pre-auth invite-only signup enforcement
-- - Pre-auth helper: check pending invite by email
-- - Pre-auth helper: check whether auth user already exists by email
-- - Supabase before_user_created hook: allow creation only for invited emails

drop function if exists public.has_pending_invite_email(text);
drop function if exists public.has_auth_user_email(text);
drop function if exists public.before_user_created_invite_gate(jsonb);

create or replace function public.has_pending_invite_email(p_email text)
returns boolean
language sql
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.brand_invites bi
    where lower(trim(bi.email)) = lower(trim(coalesce(p_email, '')))
      and (bi.expires_at is null or bi.expires_at > now())
  );
$$;

create or replace function public.has_auth_user_email(p_email text)
returns boolean
language sql
security definer
set search_path = pg_catalog, auth
as $$
  select exists (
    select 1
    from auth.users u
    where lower(trim(u.email)) = lower(trim(coalesce(p_email, '')))
      and u.deleted_at is null
  );
$$;

create or replace function public.before_user_created_invite_gate(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_email text;
begin
  v_email := lower(
    trim(
      coalesce(
        event -> 'user' ->> 'email',
        event ->> 'email',
        event -> 'new_record' ->> 'email',
        ''
      )
    )
  );

  if v_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'account_not_found'
      )
    );
  end if;

  if public.has_pending_invite_email(v_email) then
    return event;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'account_not_found'
    )
  );
end;
$$;

alter function public.has_pending_invite_email(text) owner to postgres;
alter function public.has_auth_user_email(text) owner to postgres;
alter function public.before_user_created_invite_gate(jsonb) owner to postgres;

revoke all on function public.has_pending_invite_email(text) from public;
revoke all on function public.has_auth_user_email(text) from public;
revoke all on function public.before_user_created_invite_gate(jsonb) from public;

grant execute on function public.has_pending_invite_email(text) to service_role;
grant execute on function public.has_auth_user_email(text) to service_role;
grant execute on function public.before_user_created_invite_gate(jsonb) to service_role;
