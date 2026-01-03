begin;

-- 0) Prereqs and hygiene
create extension if not exists pgcrypto;

-- Ensure RLS is enabled
alter table public.brand_invites enable row level security;
alter table public.brand_members enable row level security;

-- 1) Helpful indexes (idempotent)
-- Fast recipient lookups by email
create index if not exists idx_brand_invites_email_lower
  on public.brand_invites ((lower(trim(email))));

-- Fast validity checks by brand and expiry
create index if not exists idx_brand_invites_valid_lookup
  on public.brand_invites (brand_id, expires_at);

-- If token_hash is TEXT hex, keep an index (unique may already exist)
create index if not exists idx_brand_invites_token_hash
  on public.brand_invites (token_hash);

-- (Usually already present) uniqueness for membership
create unique index if not exists ux_brand_members_user_brand
  on public.brand_members (user_id, brand_id);

-- 2) Remove fragile write-time invitee policies on brand_members
drop policy if exists brand_members_insert_by_invitee on public.brand_members;
drop policy if exists brand_members_update_by_invitee_with_matching_invite on public.brand_members;

-- Forbid direct client writes; writes will go via SECURITY DEFINER RPC
revoke insert, update, delete on public.brand_members from authenticated;

-- 3) Recipient-centric read policies using auth claims (no joins to public.users)
drop policy if exists brand_invites_select_for_recipient on public.brand_invites;
create policy brand_invites_select_for_recipient
on public.brand_invites
for select
to authenticated
using (
  lower(trim(public.brand_invites.email)) = lower(trim(coalesce((select auth.email()), (select auth.jwt() ->> 'email'))))
);

drop policy if exists brand_invites_delete_by_recipient on public.brand_invites;
create policy brand_invites_delete_by_recipient
on public.brand_invites
for delete
to authenticated
using (
  lower(trim(public.brand_invites.email)) = lower(trim(coalesce((select auth.email()), (select auth.jwt() ->> 'email'))))
);

-- 4) Brands and Storage: remove joins to public.users; key off JWT email
drop policy if exists brands_select_for_invite_recipients on public.brands;
create policy brands_select_for_invite_recipients
on public.brands
for select
to authenticated
using (
  exists (
    select 1
    from public.brand_invites bi
    where bi.brand_id = public.brands.id
      and (bi.expires_at is null or bi.expires_at > now())
      and lower(trim(bi.email)) = lower(trim(coalesce((select auth.email()), (select auth.jwt() ->> 'email'))))
  )
);

drop policy if exists "Allow invitees read brand avatars" on storage.objects;
create policy "Allow invitees read brand avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'brand-avatars'
  and exists (
    select 1
    from public.brand_invites bi
    where (path_tokens[1])::uuid = bi.brand_id
      and (bi.expires_at is null or bi.expires_at > now())
      and lower(trim(bi.email)) = lower(trim(coalesce((select auth.email()), (select auth.jwt() ->> 'email'))))
  )
);

-- NOTE:
-- Keep your existing owner/member read policies for brand_members (e.g., select-for-members)
-- so owners can list members. We are only removing invitee INSERT/UPDATE write policies.

-- 5) SECURITY DEFINER RPC: accept invite in one transaction
-- Accepts either a raw token or a precomputed 64-char hex token_hash.
create or replace function public.accept_invite_from_cookie(p_token text)
returns void
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
begin
  -- Normalize token: if looks like hex hash, use it; otherwise hash raw token to hex
  if p_token ~ '^[0-9A-Fa-f]{64}$' then
    v_token_hash := lower(p_token);
  else
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');
  end if;

  -- Fetch a valid invite for this token
  select bi.email, bi.brand_id, bi.role
    into v_email, v_brand, v_role
  from public.brand_invites bi
  where bi.token_hash = v_token_hash
    and (bi.expires_at is null or bi.expires_at > v_now)
  limit 1;

  if not found then
    raise exception 'Invite not found or expired';
  end if;

  -- Bind to caller identity (JWT email)
  if lower(trim(v_email)) <> lower(trim(coalesce(auth.email(), auth.jwt() ->> 'email'))) then
    raise exception 'Invite does not belong to the current user';
  end if;

  -- Create or elevate membership
  insert into public.brand_members(user_id, brand_id, role)
  values (auth.uid(), v_brand, v_role)
  on conflict (user_id, brand_id) do update
  set role = excluded.role;

  -- Set active brand
  update public.users
    set brand_id = v_brand
  where id = auth.uid();

  -- Delete the invite on resolution
  delete from public.brand_invites
  where token_hash = v_token_hash
    and brand_id = v_brand
    and lower(trim(email)) = lower(trim(v_email));
end;
$$;

-- Ownership and execute permissions
alter function public.accept_invite_from_cookie(text) owner to postgres;
revoke all on function public.accept_invite_from_cookie(text) from public;
grant execute on function public.accept_invite_from_cookie(text) to authenticated;

commit;