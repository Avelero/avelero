-- update_avatar_hue_range.sql
-- Purpose: widen avatar_hue range to 1..360 on users and brands

-- Drop any existing CHECK constraints that mention avatar_hue on the target tables
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname  AS schema_name,
           t.relname  AS table_name,
           c.conname  AS constraint_name
    FROM pg_constraint c
    JOIN pg_class t      ON t.oid = c.conrelid
    JOIN pg_namespace n  ON n.oid = t.relnamespace
    WHERE c.contype = 'c'
      AND n.nspname = 'public'
      AND t.relname IN ('users','brands')
      AND pg_get_constraintdef(c.oid) ILIKE '%avatar_hue%'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.schema_name, r.table_name, r.constraint_name);
  END LOOP;
END$$;

-- Re-add explicit, stable names with the new allowed range
ALTER TABLE public.users
  ADD CONSTRAINT users_avatar_hue_check
  CHECK (avatar_hue IS NULL OR (avatar_hue >= 1 AND avatar_hue <= 360));

ALTER TABLE public.brands
  ADD CONSTRAINT brands_avatar_hue_check
  CHECK (avatar_hue IS NULL OR (avatar_hue >= 1 AND avatar_hue <= 360));