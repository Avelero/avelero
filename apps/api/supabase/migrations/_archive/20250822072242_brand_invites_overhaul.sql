begin;

-- 0) Drop policies that depend on brand_invites.status BEFORE removing the column
drop policy if exists brands_select_for_invite_recipients on public.brands;
drop policy if exists "Allow invitees read brand avatars" on storage.objects;

-- 1) brand_invites: token_hash nullability + unique index (partial), remove status/accepted/fulfilled
alter table public.brand_invites
  drop constraint if exists brand_invites_token_hash_key;

alter table public.brand_invites
  alter column token_hash drop not null;

create unique index if not exists ux_brand_invites_token_hash_not_null
  on public.brand_invites(token_hash)
  where token_hash is not null;

drop index if exists public.idx_brand_invites_status;

alter table public.brand_invites
  drop column if exists accepted_at,
  drop column if exists fulfilled_at,
  drop column if exists status;

-- ensure RLS enabled (noop if already)
alter table public.brand_invites enable row level security;

-- 2) brand_invites RLS: recipient + owner flows and admin listing
drop policy if exists brand_invites_select_for_recipient on public.brand_invites;
create policy brand_invites_select_for_recipient
on public.brand_invites
for select to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(u.email) = lower(public.brand_invites.email)
  )
);

drop policy if exists brand_invites_delete_by_recipient on public.brand_invites;
create policy brand_invites_delete_by_recipient
on public.brand_invites
for delete to authenticated
using (
  exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and lower(u.email) = lower(public.brand_invites.email)
  )
);

drop policy if exists brand_invites_insert_by_owner on public.brand_invites;
create policy brand_invites_insert_by_owner
on public.brand_invites
for insert to authenticated
with check (public.is_brand_owner(public.brand_invites.brand_id));

drop policy if exists brand_invites_delete_by_owner on public.brand_invites;
create policy brand_invites_delete_by_owner
on public.brand_invites
for delete to authenticated
using (public.is_brand_owner(public.brand_invites.brand_id));

-- no longer needed now that invites are deleted on resolution
drop policy if exists brand_invites_update_by_recipient on public.brand_invites;

drop policy if exists brand_invites_select_for_members on public.brand_invites;
create policy brand_invites_select_for_members
on public.brand_invites
for select to authenticated
using (
  public.is_brand_member(public.brand_invites.brand_id)
  or public.is_brand_creator(public.brand_invites.brand_id)
);

-- 3) brand_members RLS: allow invitee to create their own membership (and support upsert)
alter table public.brand_members enable row level security;

drop policy if exists brand_members_insert_by_invitee on public.brand_members;
create policy brand_members_insert_by_invitee on public.brand_members
for insert to authenticated
with check (
  public.brand_members.user_id = auth.uid()
  and exists (
    select 1
    from public.brand_invites bi
    join public.users u on u.id = auth.uid()
    where bi.brand_id = public.brand_members.brand_id
      and lower(bi.email) = lower(u.email)
      and (bi.expires_at is null or bi.expires_at > now())
  )
);

drop policy if exists brand_members_update_by_invitee_with_matching_invite on public.brand_members;
create policy brand_members_update_by_invitee_with_matching_invite on public.brand_members
for update to authenticated
using (public.brand_members.user_id = auth.uid())
with check (
  public.brand_members.user_id = auth.uid()
  and exists (
    select 1
    from public.brand_invites bi
    join public.users u on u.id = auth.uid()
    where bi.brand_id = public.brand_members.brand_id
      and lower(bi.email) = lower(u.email)
      and bi.role = public.brand_members.role
      and (bi.expires_at is null or bi.expires_at > now())
  )
);

-- 4) brands: invitee brand metadata access (no status dependency)
create policy brands_select_for_invite_recipients
on public.brands
for select to authenticated
using (
  exists (
    select 1
    from public.brand_invites bi
    join public.users u on u.id = auth.uid()
    where bi.brand_id = public.brands.id
      and lower(bi.email) = lower(u.email)
      and (bi.expires_at is null or bi.expires_at > now())
  )
);

-- 5) storage: invitee read brand avatars (no status dependency)
create policy "Allow invitees read brand avatars"
on storage.objects
for select to authenticated
using (
  bucket_id = 'brand-avatars'
  and exists (
    select 1
    from public.brand_invites bi
    join public.users u on u.id = auth.uid()
    where (path_tokens[1])::uuid = bi.brand_id
      and lower(bi.email) = lower(u.email)
      and (bi.expires_at is null or bi.expires_at > now())
  )
);

-- 6) cleanup legacy claim-invites triggers/functions (safe if not present)
drop trigger if exists on_auth_user_created_claim_invites on auth.users;
drop function if exists public.handle_claim_invites_after_auth_user_created();
drop function if exists public.claim_invites_for_user(uuid);

commit;