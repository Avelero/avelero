begin;

-- Make brand_invites.created_by a normal column (remove FK constraint)
alter table public.brand_invites
  drop constraint if exists brand_invites_created_by_fkey;

commit;