-- =============================================
-- FIX: Handle DELETE operations correctly in broadcast_domain_changes
-- 
-- Problem: On DELETE, NEW record is NULL, so accessing NEW.brand_id fails
-- with "record 'new' has no field 'brand_id'" error.
--
-- Solution: Check TG_OP first and only access NEW for INSERT/UPDATE,
-- and only access OLD for UPDATE/DELETE.
-- =============================================

CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = realtime, public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  brand_id_value uuid;
  domain_name text;
  record_data record;
BEGIN
  -- Get brand_id based on operation type
  -- DELETE: only OLD exists
  -- INSERT: only NEW exists  
  -- UPDATE: both exist, prefer NEW
  IF TG_OP = 'DELETE' THEN
    brand_id_value := OLD.brand_id;
    record_data := OLD;
  ELSE
    brand_id_value := NEW.brand_id;
    record_data := NEW;
  END IF;

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
    -- Notifications domain
    WHEN 'notifications' THEN 'notifications'
    ELSE 'unknown'
  END;

  -- Skip broadcast for unknown domains (defensive check)
  IF domain_name = 'unknown' THEN
    RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no domain mapping configured', TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  -- Broadcast the change to domain:brand_id topic
  -- Pass NEW/OLD appropriately based on operation
  IF TG_OP = 'DELETE' THEN
    PERFORM realtime.broadcast_changes(
      domain_name || ':' || brand_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NULL::record,  -- NEW is NULL for DELETE
      OLD
    );
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM realtime.broadcast_changes(
      domain_name || ':' || brand_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      NULL::record   -- OLD is NULL for INSERT
    );
  ELSE -- UPDATE
    PERFORM realtime.broadcast_changes(
      domain_name || ':' || brand_id_value::text,
      TG_OP,
      TG_OP,
      TG_TABLE_NAME,
      TG_TABLE_SCHEMA,
      NEW,
      OLD
    );
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION realtime.broadcast_domain_changes() IS
  'Broadcasts row changes to Supabase Realtime channels based on domain mapping. Fixed to handle DELETE operations correctly.';
