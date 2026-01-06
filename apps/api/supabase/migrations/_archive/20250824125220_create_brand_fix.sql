begin;

-- Re-enable client writes to brand_members; RLS still gates them
grant insert, update, delete on table public.brand_members to authenticated;

commit;