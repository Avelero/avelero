begin;

-- Re-enable client writes to users_on_brand; RLS still gates them
grant insert, update, delete on table public.users_on_brand to authenticated;

commit;