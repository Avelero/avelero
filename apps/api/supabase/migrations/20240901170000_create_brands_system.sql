-- brands and membership system

-- create brands table
create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text,
  logo_url text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brands_created_by on public.brands(created_by);

-- enable rls
alter table public.brands enable row level security;

-- update timestamp trigger
create trigger update_brands_updated_at
before update on public.brands
for each row execute function update_updated_at();

-- create users_on_brand (membership) table
create table public.users_on_brand (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  role text not null check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, brand_id)
);

create index if not exists idx_users_on_brand_brand_id on public.users_on_brand(brand_id);
create index if not exists idx_users_on_brand_user_id on public.users_on_brand(user_id);

-- enable rls
alter table public.users_on_brand enable row level security;

-- update timestamp trigger
create trigger update_users_on_brand_updated_at
before update on public.users_on_brand
for each row execute function update_updated_at();

create or replace function public.get_brands_for_authenticated_user()
returns table(brand_id uuid)
language sql
security definer
set search_path = public
as $$
  select uob.brand_id
  from public.users_on_brand uob
  where uob.user_id = auth.uid();
$$;

-- helper: is current user a member of brand
create or replace function public.is_brand_member(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_on_brand uob
    where uob.brand_id = b_id and uob.user_id = auth.uid()
  );
$$;

-- helper: is current user an owner of brand
create or replace function public.is_brand_owner(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users_on_brand uob
    where uob.brand_id = b_id and uob.user_id = auth.uid() and uob.role = 'owner'
  );
$$;

-- helper: is current user creator of brand (used to allow first membership insert)
create or replace function public.is_brand_creator(b_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.brands b
    where b.id = b_id and b.created_by = auth.uid()
  );
$$;

-- RLS policies for brands
drop policy if exists brands_select_for_members on public.brands;
create policy brands_select_for_members on public.brands
for select to authenticated
using (brands.id in (select brand_id from public.get_brands_for_authenticated_user()));

drop policy if exists brands_insert_by_creator on public.brands;
create policy brands_insert_by_creator on public.brands
for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists brands_update_by_owner on public.brands;
create policy brands_update_by_owner on public.brands
for update to authenticated
using (public.is_brand_owner(brands.id));

drop policy if exists brands_delete_by_owner on public.brands;
create policy brands_delete_by_owner on public.brands
for delete to authenticated
using (public.is_brand_owner(brands.id));

-- RLS policies for users_on_brand
drop policy if exists users_on_brand_select_for_members on public.users_on_brand;
create policy users_on_brand_select_for_members on public.users_on_brand
for select to authenticated
using (public.is_brand_member(users_on_brand.brand_id));

drop policy if exists users_on_brand_insert_owner_self on public.users_on_brand;
create policy users_on_brand_insert_owner_self on public.users_on_brand
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_brand_creator(users_on_brand.brand_id)
);

drop policy if exists users_on_brand_update_by_owner on public.users_on_brand;
create policy users_on_brand_update_by_owner on public.users_on_brand
for update to authenticated
using (public.is_brand_owner(users_on_brand.brand_id));

drop policy if exists users_on_brand_delete_by_owner on public.users_on_brand;
create policy users_on_brand_delete_by_owner on public.users_on_brand
for delete to authenticated
using (public.is_brand_owner(users_on_brand.brand_id));

-- active brand on users profile
alter table public.users
add column if not exists brand_id uuid references public.brands(id);

-- replace update policy to enforce membership on brand_id changes
drop policy if exists update_own_profile on public.users;
create policy update_own_profile on public.users
for update to authenticated
using (auth.uid() = id)
with check (
  auth.uid() = id
  and (
    brand_id is null
    or exists (
      select 1 from public.users_on_brand uob
      where uob.brand_id = brand_id and uob.user_id = auth.uid()
    )
  )
);

 