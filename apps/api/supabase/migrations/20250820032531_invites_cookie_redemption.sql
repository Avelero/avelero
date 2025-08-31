-- Invites cookie redemption migration
-- 1) Make token_hash nullable and enforce uniqueness only when not null
-- 2) Add recipient RLS policies (select/update) so invitees can manage their own invites
-- 3) Remove auto-claim trigger and functions; redemption now happens post-auth via cookie

-- 1) token_hash nullable + partial unique index
alter table public.brand_invites
  drop constraint if exists brand_invites_token_hash_key;

alter table public.brand_invites
  alter column token_hash drop not null;

-- create a unique index that only applies when token_hash is not null
create unique index if not exists ux_brand_invites_token_hash_not_null
  on public.brand_invites(token_hash)
  where token_hash is not null;

-- 2) Recipient RLS: allow invitee (by email) to read and update their own invites

-- Select: recipients can read their invites by matching email to the authenticated user's email
drop policy if exists brand_invites_select_for_recipient on public.brand_invites;
create policy brand_invites_select_for_recipient
on public.brand_invites
for select to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and lower(u.email) = lower(public.brand_invites.email)
  )
);

-- Update: recipients can update their invites (server restricts fields to status changes)
drop policy if exists brand_invites_update_by_recipient on public.brand_invites;
create policy brand_invites_update_by_recipient
on public.brand_invites
for update to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid()
      and lower(u.email) = lower(public.brand_invites.email)
  )
);

-- 3) Remove invite auto-claim trigger and functions (now handled via cookie redemption after login)
drop trigger if exists on_auth_user_created_claim_invites on auth.users;

drop function if exists public.handle_claim_invites_after_auth_user_created();
drop function if exists public.claim_invites_for_user(uuid);


