-- Phase 1 invite redemption contract:
-- - Return structured status/error instead of throwing exceptions
-- - Ensure public.users row exists before writing brand_members
drop function if exists public.accept_invite_from_cookie(text);

create or replace function public.accept_invite_from_cookie(p_token text)
returns table (
  status text,
  brand_id uuid,
  error_code text
)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now         timestamptz := now();
  v_token_hash  text;
  v_email       text;
  v_brand       uuid;
  v_role        text;
  v_auth_email  text;
  v_auth_uid    uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    return query select 'error'::text, null::uuid, 'expired_or_revoked'::text;
    return;
  end if;

  -- Normalize token: if looks like hash use it, otherwise hash raw token.
  if p_token ~ '^[0-9A-Fa-f]{64}$' then
    v_token_hash := lower(p_token);
  else
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  end if;

  select bi.email, bi.brand_id, bi.role
    into v_email, v_brand, v_role
  from public.brand_invites bi
  where bi.token_hash = v_token_hash
    and (bi.expires_at is null or bi.expires_at > v_now)
  limit 1;

  if not found then
    return query select 'error'::text, null::uuid, 'expired_or_revoked'::text;
    return;
  end if;

  v_auth_email := lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email', '')));
  v_auth_uid := auth.uid();

  if v_auth_uid is null or v_auth_email = '' then
    return query select 'error'::text, null::uuid, 'accept_failed'::text;
    return;
  end if;

  if lower(trim(v_email)) <> v_auth_email then
    return query select 'error'::text, null::uuid, 'wrong_email'::text;
    return;
  end if;

  begin
    -- Ensure profile row exists before membership write to avoid FK errors.
    insert into public.users (id, email, full_name, brand_id)
    values (
      v_auth_uid,
      coalesce(auth.email(), auth.jwt() ->> 'email', v_email),
      null,
      v_brand
    )
    on conflict (id) do update
    set email = excluded.email,
        brand_id = excluded.brand_id,
        updated_at = now();

    insert into public.brand_members(user_id, brand_id, role)
    values (v_auth_uid, v_brand, v_role)
    on conflict (user_id, brand_id) do update
    set role = excluded.role;

    update public.users
    set brand_id = v_brand,
        updated_at = now()
    where id = v_auth_uid;

    delete from public.brand_invites
    where token_hash = v_token_hash
      and brand_id = v_brand
      and lower(trim(email)) = lower(trim(v_email));

    return query select 'accepted'::text, v_brand, null::text;
    return;
  exception
    when others then
      return query select 'error'::text, null::uuid, 'accept_failed'::text;
      return;
  end;
end;
$$;

alter function public.accept_invite_from_cookie(text) owner to postgres;
revoke all on function public.accept_invite_from_cookie(text) from public;
grant execute on function public.accept_invite_from_cookie(text) to anon;
grant execute on function public.accept_invite_from_cookie(text) to authenticated;
grant execute on function public.accept_invite_from_cookie(text) to service_role;
