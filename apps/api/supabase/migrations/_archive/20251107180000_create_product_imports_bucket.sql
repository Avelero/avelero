-- Product imports storage bucket for bulk product import files
-- Path structure: {brand_id}/{job_id}/{filename}
-- File types: CSV, XLSX
-- Max file size: 5GB (enforced at application level)

-- Create product-imports bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-imports',
  'product-imports',
  false,
  5368709120, -- 5GB in bytes
  array['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Ensure RLS is enabled on storage.objects
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

-- Storage RLS: product-imports bucket
-- Path structure enforces brand isolation: {brand_id}/{job_id}/{filename}

-- INSERT: Allow brand members to upload import files to their brand's directory
drop policy if exists "Allow brand members upload import files" on storage.objects;
create policy "Allow brand members upload import files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'product-imports'
  and public.is_brand_member((path_tokens[1])::uuid)
);

-- SELECT: Allow brand members to download import files from their brand's directory
drop policy if exists "Allow brand members read import files" on storage.objects;
create policy "Allow brand members read import files"
on storage.objects for select to authenticated
using (
  bucket_id = 'product-imports'
  and public.is_brand_member((path_tokens[1])::uuid)
);

-- UPDATE: Allow brand owners to update import files in their brand's directory
drop policy if exists "Allow brand owners update import files" on storage.objects;
create policy "Allow brand owners update import files"
on storage.objects for update to authenticated
using (
  bucket_id = 'product-imports'
  and public.is_brand_owner((path_tokens[1])::uuid)
)
with check (
  bucket_id = 'product-imports'
  and public.is_brand_owner((path_tokens[1])::uuid)
);

-- DELETE: Allow brand owners to delete import files from their brand's directory
drop policy if exists "Allow brand owners delete import files" on storage.objects;
create policy "Allow brand owners delete import files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'product-imports'
  and public.is_brand_owner((path_tokens[1])::uuid)
);
