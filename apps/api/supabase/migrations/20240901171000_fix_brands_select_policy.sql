-- Allow brand creators to read their just-created rows (needed for INSERT ... RETURNING via supabase.select)
-- Replaces the previous select policy that only allowed members

drop policy if exists brands_select_for_members on public.brands;
create policy brands_select_for_members on public.brands
for select to authenticated
using (
  public.is_brand_member(brands.id)
  or brands.created_by = auth.uid()
);


