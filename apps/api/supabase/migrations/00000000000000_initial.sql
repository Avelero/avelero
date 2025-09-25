-- Initial consolidated schema for Avelero
-- Run on a clean reset. This defines the final desired state.

-- -----------------------------------------------------------------------------
-- Extensions
-- -----------------------------------------------------------------------------
create extension if not exists pgcrypto with schema public;

-- -----------------------------------------------------------------------------
-- Utility trigger: update_updated_at
-- -----------------------------------------------------------------------------
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- -----------------------------------------------------------------------------
-- Users
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id uuid primary key,
  email text unique not null,
  full_name text,
  avatar_url text,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fk_auth_user foreign key (id) references auth.users(id) on delete cascade
);

alter table public.users enable row level security;

create trigger users_updated_at
before update on public.users
for each row execute function public.update_updated_at();

-- Mirror auth.users into public.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  user_count integer;
  user_role text;
begin
  -- Check if any users already exist
  select count(*) into user_count from public.users;

  -- Determine the role based on user count
  if user_count = 0 then
    user_role := 'owner';
  else
    user_role := 'member';
  end if;

  insert into public.users (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    user_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Optional: allow service role inserts into public.users
drop policy if exists users_insert_by_service on public.users;
create policy users_insert_by_service
on public.users
for insert to service_role
with check (true);

-- -----------------------------------------------------------------------------
-- Brands and Memberships
-- -----------------------------------------------------------------------------
create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country_code text,
  logo_url text,
  created_by uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brands_created_by on public.brands(created_by);

alter table public.brands enable row level security;

create trigger update_brands_updated_at
before update on public.brands
for each row execute function public.update_updated_at();

-- Memberships
create table if not exists public.users_on_brand (
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

alter table public.users_on_brand enable row level security;

create trigger update_users_on_brand_updated_at
before update on public.users_on_brand
for each row execute function public.update_updated_at();

-- Helper functions
create or replace function public.get_brands_for_authenticated_user()
returns table(member_brand_id uuid)
language sql
security definer
set search_path = public
as $$
  select uob.brand_id as member_brand_id
  from public.users_on_brand uob
  where uob.user_id = auth.uid();
$$;

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

-- Users.active brand linkage
alter table public.users
add column if not exists brand_id uuid references public.brands(id);

-- Users RLS policies
drop policy if exists select_own_profile on public.users;
create policy select_own_profile on public.users
for select
using (auth.uid() = public.users.id);

drop policy if exists update_own_profile on public.users;
create policy update_own_profile on public.users
for update to authenticated
using (auth.uid() = public.users.id)
with check (
  auth.uid() = public.users.id
  and (
    public.users.brand_id is null
    or exists (
      select 1
      from public.users_on_brand uob
      where uob.brand_id = public.users.brand_id
        and uob.user_id = auth.uid()
    )
  )
);

-- Brands RLS policies
drop policy if exists brands_select_for_members on public.brands;
create policy brands_select_for_members on public.brands
for select to authenticated
using (
  public.is_brand_member(public.brands.id)
  or public.brands.created_by = auth.uid()
);

drop policy if exists brands_insert_by_creator on public.brands;
create policy brands_insert_by_creator on public.brands
for insert to authenticated
with check (public.brands.created_by = auth.uid());

drop policy if exists brands_update_by_owner on public.brands;
create policy brands_update_by_owner on public.brands
for update to authenticated
using (public.is_brand_owner(public.brands.id));

drop policy if exists brands_delete_by_owner on public.brands;
create policy brands_delete_by_owner on public.brands
for delete to authenticated
using (public.is_brand_owner(public.brands.id));

-- Membership RLS policies
drop policy if exists users_on_brand_select_for_members on public.users_on_brand;
create policy users_on_brand_select_for_members on public.users_on_brand
for select to authenticated
using (public.is_brand_member(public.users_on_brand.brand_id));

drop policy if exists users_on_brand_insert_owner_self on public.users_on_brand;
create policy users_on_brand_insert_owner_self on public.users_on_brand
for insert to authenticated
with check (
  public.users_on_brand.user_id = auth.uid()
  and public.is_brand_creator(public.users_on_brand.brand_id)
);

drop policy if exists users_on_brand_update_by_owner on public.users_on_brand;
create policy users_on_brand_update_by_owner on public.users_on_brand
for update to authenticated
using (public.is_brand_owner(public.users_on_brand.brand_id));

drop policy if exists users_on_brand_delete_by_owner on public.users_on_brand;
create policy users_on_brand_delete_by_owner on public.users_on_brand
for delete to authenticated
using (public.is_brand_owner(public.users_on_brand.brand_id));

-- -----------------------------------------------------------------------------
-- Brand Invites
-- -----------------------------------------------------------------------------
create table if not exists public.brand_invites (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  email text not null,
  role text not null check (role in ('owner','member')),
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending','accepted','fulfilled','revoked','expired')),
  accepted_at timestamptz,
  fulfilled_at timestamptz,
  expires_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_brand_invites_brand_id on public.brand_invites(brand_id);
create index if not exists idx_brand_invites_email on public.brand_invites(lower(email));
create index if not exists idx_brand_invites_status on public.brand_invites(status);
create index if not exists idx_brand_invites_accepted_at on public.brand_invites(accepted_at);
create index if not exists idx_brand_invites_expires_at on public.brand_invites(expires_at);

alter table public.brand_invites enable row level security;

create trigger update_brand_invites_updated_at
before update on public.brand_invites
for each row execute function public.update_updated_at();

drop policy if exists brand_invites_select_for_members on public.brand_invites;
create policy brand_invites_select_for_members on public.brand_invites
for select to authenticated
using (public.is_brand_member(public.brand_invites.brand_id));

drop policy if exists brand_invites_insert_by_owner on public.brand_invites;
create policy brand_invites_insert_by_owner on public.brand_invites
for insert to authenticated
with check (public.is_brand_owner(public.brand_invites.brand_id));

drop policy if exists brand_invites_update_by_owner on public.brand_invites;
create policy brand_invites_update_by_owner on public.brand_invites
for update to authenticated
using (public.is_brand_owner(public.brand_invites.brand_id));

drop policy if exists brand_invites_delete_by_owner on public.brand_invites;
create policy brand_invites_delete_by_owner on public.brand_invites
for delete to authenticated
using (public.is_brand_owner(public.brand_invites.brand_id));

-- FIXED: Claim accepted invites for a user and attach memberships
create or replace function public.claim_invites_for_user(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  -- Get the user's email
  select email into v_email from public.users where id = p_user_id;
  
  -- If no email found, exit early
  if v_email is null then
    return;
  end if;

  -- Find eligible invites and insert memberships
  with eligible as (
    select bi.id, bi.brand_id, bi.role
    from public.brand_invites bi
    where lower(bi.email) = lower(v_email)
      and bi.status = 'accepted'
      and (bi.expires_at is null or bi.expires_at > now())
  ), 
  inserted as (
    insert into public.users_on_brand (user_id, brand_id, role)
    select p_user_id, e.brand_id, e.role 
    from eligible e
    on conflict (user_id, brand_id) do update 
      set role = excluded.role
    returning users_on_brand.brand_id
  )
  -- Update the invite status to fulfilled
  update public.brand_invites bi
  set status = 'fulfilled', fulfilled_at = now()
  from eligible e
  where bi.id = e.id 
    and bi.status <> 'fulfilled';
end;
$$;

-- Trigger after auth.users insert to auto-claim invites
create or replace function public.handle_claim_invites_after_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Claim any invites for this user
  perform public.claim_invites_for_user(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_claim_invites on auth.users;
create trigger on_auth_user_created_claim_invites
after insert on auth.users
for each row
execute function public.handle_claim_invites_after_auth_user_created();

-- -----------------------------------------------------------------------------
-- Storage: avatars bucket and policies
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Do not force-enable RLS on storage.objects on Supabase Cloud
-- Only attempt locally when you are the owner
do $$
declare
  owner text;
begin
  select pg_get_userbyid(c.relowner)
  into owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'storage' and c.relname = 'objects';

  if owner = current_user then
    execute 'alter table storage.objects enable row level security';
  end if;
end $$;

drop policy if exists "Allow authenticated uploads to avatars" on storage.objects;
create policy "Allow authenticated uploads to avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (path_tokens[1] = (auth.uid())::text)
);

drop policy if exists "Allow public read of avatars" on storage.objects;
create policy "Allow public read of avatars"
on storage.objects for select to public
using (bucket_id = 'avatars');

drop policy if exists "Allow owner update avatars" on storage.objects;
create policy "Allow owner update avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text)
with check (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);

drop policy if exists "Allow owner delete avatars" on storage.objects;
create policy "Allow owner delete avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);