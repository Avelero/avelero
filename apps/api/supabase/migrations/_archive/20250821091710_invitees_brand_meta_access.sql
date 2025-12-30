-- Allow invite recipients to read minimal brand metadata (name/logo) for their invites
drop policy if exists brands_select_for_invite_recipients on public.brands;
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
      and bi.status in ('pending','fulfilled')
  )
);

-- Allow invite recipients to read brand avatar objects (brand-avatars bucket)
drop policy if exists "Allow invitees read brand avatars" on storage.objects;
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
      and bi.status in ('pending','fulfilled')
  )
);