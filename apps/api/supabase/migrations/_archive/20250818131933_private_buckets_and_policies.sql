-- Private buckets and storage policies for user and brand avatars

-- Buckets --------------------------------------------------------------------
-- Ensure user avatars bucket exists and is private
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = excluded.public;

-- Create private brand avatars bucket
insert into storage.buckets (id, name, public)
values ('brand-avatars', 'brand-avatars', false)
on conflict (id) do update set public = excluded.public;

-- Helper function -------------------------------------------------------------
-- Returns true if the current authenticated user shares at least one brand
-- membership with the provided user id
create or replace function public.shares_brand_with(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brand_members u1
    join public.brand_members u2 on u1.brand_id = u2.brand_id
    where u1.user_id = p_user_id
      and u2.user_id = auth.uid()
  );
$$;

-- Storage RLS: avatars (user avatars) ----------------------------------------
-- Enforce RLS only if we own the table locally (safe for Supabase Cloud)
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

-- Insert by owner (first token = auth.uid())
drop policy if exists "Allow authenticated uploads to avatars" on storage.objects;
create policy "Allow authenticated uploads to avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (path_tokens[1] = (auth.uid())::text)
);

-- Remove public read
drop policy if exists "Allow public read of avatars" on storage.objects;

-- Select by owner or users who share a brand with the owner
drop policy if exists "Allow select of user avatars by owner or brand members" on storage.objects;
create policy "Allow select of user avatars by owner or brand members"
on storage.objects for select to authenticated
using (
  bucket_id = 'avatars'
  and (
    (path_tokens[1] = (auth.uid())::text)
    or public.shares_brand_with((path_tokens[1])::uuid)
  )
);

-- Update/Delete by owner only
drop policy if exists "Allow owner update avatars" on storage.objects;
create policy "Allow owner update avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text)
with check (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);

drop policy if exists "Allow owner delete avatars" on storage.objects;
create policy "Allow owner delete avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);

-- Storage RLS: brand-avatars (brand avatars) ---------------------------------
-- Insert/Update/Delete restricted to brand owners
drop policy if exists "Allow owner upload brand avatars" on storage.objects;
create policy "Allow owner upload brand avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'brand-avatars'
  and public.is_brand_owner((path_tokens[1])::uuid)
);

drop policy if exists "Allow owner update brand avatars" on storage.objects;
create policy "Allow owner update brand avatars"
on storage.objects for update to authenticated
using (
  bucket_id = 'brand-avatars' and public.is_brand_owner((path_tokens[1])::uuid)
)
with check (
  bucket_id = 'brand-avatars' and public.is_brand_owner((path_tokens[1])::uuid)
);

drop policy if exists "Allow owner delete brand avatars" on storage.objects;
create policy "Allow owner delete brand avatars"
on storage.objects for delete to authenticated
using (
  bucket_id = 'brand-avatars' and public.is_brand_owner((path_tokens[1])::uuid)
);

-- Select allowed for all brand members
drop policy if exists "Allow members read brand avatars" on storage.objects;
create policy "Allow members read brand avatars"
on storage.objects for select to authenticated
using (
  bucket_id = 'brand-avatars'
  and public.is_brand_member((path_tokens[1])::uuid)
);


