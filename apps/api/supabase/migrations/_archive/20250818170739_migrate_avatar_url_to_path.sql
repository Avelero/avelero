-- Add path columns so the app can store storage object paths instead of URLs
alter table public.users
  add column if not exists avatar_path text;

alter table public.brands
  add column if not exists logo_path text;

-- Users: backfill avatar_path from known URL shapes (public and old proxy)
update public.users
set avatar_path = coalesce(
  nullif(substring(avatar_url from '/storage/v1/object/[^/]+/avatars/([^?]+)'), ''),
  nullif(substring(avatar_url from '/api/images/avatars/([^?]+)'), ''),
  avatar_path
)
where avatar_url is not null
  and avatar_path is null;

-- Brands: backfill logo_path from known URL shapes (public and old proxy)
update public.brands
set logo_path = coalesce(
  nullif(substring(logo_url from '/storage/v1/object/[^/]+/brand-avatars/([^?]+)'), ''),
  nullif(substring(logo_url from '/api/images/brand-avatars/([^?]+)'), ''),
  logo_path
)
where logo_url is not null
  and logo_path is null;

-- Optional sanity: ensure buckets exist and are private
insert into storage.buckets (id, name, public)
values ('avatars','avatars', false)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('brand-avatars','brand-avatars', false)
on conflict (id) do update set public = excluded.public;

-- Enable RLS locally when possible (no-op on Supabase Cloud without ownership)
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

-- Drop legacy URL columns now that we store object paths and sign on render
alter table public.users
  drop column if exists avatar_url;

alter table public.brands
  drop column if exists logo_url;