-- =============================================
-- FIX: Add SET search_path to SECURITY DEFINER function
-- Prevents CVE-2018-1058 search path injection attacks
-- =============================================

-- Recreate the function with SET search_path clause
CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = realtime, public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  brand_id_value uuid;
  domain_name text;
BEGIN
  -- Get brand_id from new or old record
  brand_id_value := COALESCE(NEW.brand_id, OLD.brand_id);

  -- Skip if no brand_id (shouldn't happen, but safety check)
  IF brand_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- Map table to domain
  domain_name := CASE TG_TABLE_NAME
    -- Products domain (16 tables)
    WHEN 'products' THEN 'products'
    WHEN 'product_variants' THEN 'products'
    WHEN 'product_commercial' THEN 'products'
    WHEN 'product_weight' THEN 'products'
    WHEN 'product_materials' THEN 'products'
    WHEN 'product_eco_claims' THEN 'products'
    WHEN 'product_environment' THEN 'products'
    WHEN 'product_journey_steps' THEN 'products'
    WHEN 'product_tags' THEN 'products'
    WHEN 'product_variant_attributes' THEN 'products'
    WHEN 'variant_commercial' THEN 'products'
    WHEN 'variant_weight' THEN 'products'
    WHEN 'variant_materials' THEN 'products'
    WHEN 'variant_eco_claims' THEN 'products'
    WHEN 'variant_environment' THEN 'products'
    WHEN 'variant_journey_steps' THEN 'products'
    -- Catalog domain (9 tables)
    WHEN 'brand_materials' THEN 'catalog'
    WHEN 'brand_tags' THEN 'catalog'
    WHEN 'brand_eco_claims' THEN 'catalog'
    WHEN 'brand_attributes' THEN 'catalog'
    WHEN 'brand_attribute_values' THEN 'catalog'
    WHEN 'brand_seasons' THEN 'catalog'
    WHEN 'brand_manufacturers' THEN 'catalog'
    WHEN 'brand_facilities' THEN 'catalog'
    WHEN 'brand_certifications' THEN 'catalog'
    -- Integrations domain (5 tables)
    WHEN 'brand_integrations' THEN 'integrations'
    WHEN 'integration_sync_jobs' THEN 'integrations'
    WHEN 'integration_field_configs' THEN 'integrations'
    WHEN 'integration_product_links' THEN 'integrations'
    WHEN 'integration_variant_links' THEN 'integrations'
    -- Team domain (2 tables)
    WHEN 'brand_members' THEN 'team'
    WHEN 'brand_invites' THEN 'team'
    -- Jobs domain (2 tables)
    WHEN 'import_jobs' THEN 'jobs'
    WHEN 'export_jobs' THEN 'jobs'
    -- Theme domain (2 tables)
    WHEN 'brand_theme' THEN 'theme'
    WHEN 'brand_collections' THEN 'theme'
    ELSE 'unknown'
  END;

  -- Skip broadcast for unknown domains (defensive check)
  -- This prevents silently broadcasting to invalid channels if a table
  -- is added to the trigger but not mapped to a domain
  IF domain_name = 'unknown' THEN
    RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no domain mapping configured', TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  -- Broadcast the change to domain:brand_id topic
  PERFORM realtime.broadcast_changes(
    domain_name || ':' || brand_id_value::text,  -- topic: e.g., "products:uuid"
    TG_OP,                                        -- event: INSERT/UPDATE/DELETE
    TG_OP,                                        -- operation
    TG_TABLE_NAME,                                -- table name
    TG_TABLE_SCHEMA,                              -- schema
    NEW,                                          -- new record
    OLD                                           -- old record
  );

  RETURN NULL;
END;
$$;

-- =============================================
-- FIX: Add missing indexes on export_jobs foreign key columns
-- PostgreSQL doesn't auto-create indexes for FKs. These indexes
-- improve performance for RLS policy checks and cascade deletes.
-- =============================================

CREATE INDEX IF NOT EXISTS "export_jobs_brand_id_idx" ON "export_jobs" ("brand_id");
CREATE INDEX IF NOT EXISTS "export_jobs_user_id_idx" ON "export_jobs" ("user_id");
