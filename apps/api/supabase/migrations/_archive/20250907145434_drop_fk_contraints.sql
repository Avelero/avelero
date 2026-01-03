-- 0) Ensure each brand has an owner membership before dropping created_by
insert into public.brand_members (user_id, brand_id, role)
select b.created_by, b.id, 'owner'
from public.brands b
where not exists (
  select 1
  from public.brand_members bm
  where bm.brand_id = b.id and bm.role = 'owner'
);

-- 1) Drop objects depending on brands.created_by
drop index if exists idx_brands_created_by;

-- Function used by legacy policy
-- IMPORTANT: drop dependent policies BEFORE dropping the function

-- Replace brands select policy (remove created_by check; rely on membership)
drop policy if exists brands_select_for_members on public.brands;
create policy brands_select_for_members
on public.brands
for select to authenticated
using (public.is_brand_member(public.brands.id));

-- Replace brands insert policy (no created_by column anymore)
drop policy if exists brands_insert_by_creator on public.brands;
create policy brands_insert_by_authenticated
on public.brands
for insert to authenticated
with check (true);

-- brand_invites policy that referenced is_brand_creator
drop policy if exists brand_invites_select_for_members on public.brand_invites;
create policy brand_invites_select_for_members
on public.brand_invites
for select to authenticated
using (
  public.is_brand_member(public.brand_invites.brand_id)
);

-- 2) Drop the created_by column from brands
alter table public.brands
  drop column if exists created_by;

-- 3) Make users.brand_id a plain nullable UUID (remove FK only)
alter table public.users
  drop constraint if exists users_brand_id_fkey;

-- 4) Replace brand_members insert policy that referenced is_brand_creator
-- Allow the authenticated user to self-insert as the first owner for a brand
drop policy if exists brand_members_insert_owner_self on public.brand_members;
create policy brand_members_insert_first_owner_self
on public.brand_members
for insert to authenticated
with check (
  public.brand_members.user_id = auth.uid()
  and public.brand_members.role = 'owner'
  and not exists (
    select 1
    from public.brand_members bm
    where bm.brand_id = public.brand_members.brand_id
      and bm.role = 'owner'
  )
);

-- Now safe to drop the legacy function
drop function if exists public.is_brand_creator(uuid);