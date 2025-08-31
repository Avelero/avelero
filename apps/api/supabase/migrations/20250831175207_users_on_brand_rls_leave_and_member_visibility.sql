-- Ensure RLS enabled (no-op if already)
alter table public.users_on_brand enable row level security;
alter table public.users enable row level security;

-- 1) Users-on-brand: allow members to select brand membership rows
drop policy if exists users_on_brand_select_for_members on public.users_on_brand;
create policy users_on_brand_select_for_members
on public.users_on_brand
for select
to authenticated
using (
  public.is_brand_member(public.users_on_brand.brand_id)
);

-- 2) Users-on-brand: delete policies
-- Drop broad owner-delete policy if present
drop policy if exists users_on_brand_delete_by_owner on public.users_on_brand;

-- Self-delete for any member (including owners)
drop policy if exists users_on_brand_delete_self on public.users_on_brand;
create policy users_on_brand_delete_self
on public.users_on_brand
for delete
to authenticated
using (
  public.users_on_brand.user_id = auth.uid()
);

-- Owners can delete non-owners; owners cannot delete other owners (but can delete themselves via self-policy)
drop policy if exists users_on_brand_delete_owner_non_owner on public.users_on_brand;
create policy users_on_brand_delete_owner_non_owner
on public.users_on_brand
for delete
to authenticated
using (
  public.is_brand_owner(public.users_on_brand.brand_id)
  and (
    public.users_on_brand.role <> 'owner'
    or public.users_on_brand.user_id = auth.uid()
  )
);

-- 3) Users: allow members of the same brand to read teammate profiles
-- (relies on public.shares_brand_with(uuid) which already exists)
drop policy if exists users_select_for_brand_members on public.users;
create policy users_select_for_brand_members
on public.users
for select
to authenticated
using (
  public.shares_brand_with(public.users.id)
);