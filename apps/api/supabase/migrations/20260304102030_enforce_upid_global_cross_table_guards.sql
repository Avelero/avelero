-- Enforce global UPID uniqueness across product_variants and product_passports.
-- This guard complements:
--   1) product_variants.idx_unique_upid_global (variants table)
--   2) product_passports_upid_unique (passports table)
-- by preventing cross-table collisions (especially with orphaned passports).

-- -----------------------------------------------------------------------------
-- Guard: product_variants.upid cannot collide with an unrelated passport.upid
-- -----------------------------------------------------------------------------
create or replace function "public"."enforce_variant_upid_global_guard"()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.upid is null or btrim(new.upid) = '' then
    return new;
  end if;

  -- Serialize same-UPID checks across tables to avoid TOCTOU races.
  perform pg_advisory_xact_lock(hashtext('upid_global::' || new.upid));

  if exists (
    select 1
    from public.product_passports pp
    where pp.upid = new.upid
      and (
        pp.working_variant_id is null
        or pp.working_variant_id <> new.id
      )
  ) then
    raise exception using
      errcode = '23505',
      message = format(
        'UPID "%s" is already reserved by a passport',
        new.upid
      ),
      constraint = 'product_variants_upid_global_guard';
  end if;

  return new;
end;
$$;

drop trigger if exists "trg_product_variants_enforce_upid_global_guard" on "public"."product_variants";

create trigger "trg_product_variants_enforce_upid_global_guard"
before insert or update of "upid" on "public"."product_variants"
for each row
execute function "public"."enforce_variant_upid_global_guard"();

-- -----------------------------------------------------------------------------
-- Guard: product_passports.upid cannot collide with an unrelated variant.upid
-- -----------------------------------------------------------------------------
create or replace function "public"."enforce_passport_upid_global_guard"()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  allowed_variant_id uuid;
begin
  if new.upid is null or btrim(new.upid) = '' then
    return new;
  end if;

  -- Serialize same-UPID checks across tables to avoid TOCTOU races.
  perform pg_advisory_xact_lock(hashtext('upid_global::' || new.upid));

  -- Allow transitions where a passport is being orphaned before variant delete.
  allowed_variant_id := coalesce(new.working_variant_id, old.working_variant_id);

  if exists (
    select 1
    from public.product_variants pv
    where pv.upid = new.upid
      and (
        allowed_variant_id is null
        or pv.id <> allowed_variant_id
      )
  ) then
    raise exception using
      errcode = '23505',
      message = format(
        'UPID "%s" is already used by a variant',
        new.upid
      ),
      constraint = 'product_passports_upid_global_guard';
  end if;

  return new;
end;
$$;

drop trigger if exists "trg_product_passports_enforce_upid_global_guard" on "public"."product_passports";

create trigger "trg_product_passports_enforce_upid_global_guard"
before insert or update of "upid", "working_variant_id" on "public"."product_passports"
for each row
execute function "public"."enforce_passport_upid_global_guard"();
