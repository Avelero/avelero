-- create public avatars bucket if not exists
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- allow authenticated users to upload avatars
drop policy if exists "Allow authenticated uploads to avatars" on storage.objects;
create policy "Allow authenticated uploads to avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (path_tokens[1] = (auth.uid())::text)
);

-- allow public read of avatars objects
drop policy if exists "Allow public read of avatars" on storage.objects;
create policy "Allow public read of avatars"
on storage.objects for select to public
using (bucket_id = 'avatars');

-- allow owners to update/delete their own avatars (not strictly needed now)
drop policy if exists "Allow owner update avatars" on storage.objects;
create policy "Allow owner update avatars"
on storage.objects for update to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text)
with check (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);

drop policy if exists "Allow owner delete avatars" on storage.objects;
create policy "Allow owner delete avatars"
on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and path_tokens[1] = (auth.uid())::text);

-- allow public read (bucket is set public)
-- additional policies for update/delete can be added later if needed
