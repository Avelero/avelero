-- =============================================
-- FIX: Handle DELETE operations correctly with FK brand_id lookup
--
-- Problem: The previous fix for DELETE operations (checking TG_OP)
-- did not include the brand_id FK lookup logic for child tables.
-- This caused "record 'old' has no field 'brand_id'" errors when
-- CASCADE deleting child records (product_variants, etc.).
--
-- Solution: Combine both fixes:
-- 1. Check TG_OP before accessing NEW/OLD record fields
-- 2. Use CASE statement to resolve brand_id through FKs for child tables
-- 3. Pass correct records to broadcast_changes based on operation type
-- =============================================

-- Drop and recreate the function with complete fix
CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = realtime, public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  brand_id_value uuid;
  domain_name text;
  ref_product_id uuid;
  ref_variant_id uuid;
  ref_integration_id uuid;
BEGIN
  -- =============================================
  -- STEP 1: Extract reference IDs based on operation type
  -- DELETE: only OLD exists
  -- INSERT: only NEW exists
  -- UPDATE: both exist, use NEW for current state
  -- =============================================
  
  -- Resolve brand_id based on table structure
  -- We need to check TG_OP before accessing any record fields
  CASE TG_TABLE_NAME
    -- =============================================
    -- Tables with DIRECT brand_id column
    -- =============================================
    WHEN 'products', 'brand_materials', 'brand_tags', 'brand_eco_claims',
         'brand_attributes', 'brand_attribute_values', 'brand_seasons',
         'brand_manufacturers', 'brand_facilities', 'brand_certifications',
         'brand_integrations', 'brand_members', 'brand_invites',
         'import_jobs', 'export_jobs', 'brand_theme', 'brand_collections',
         'notifications' THEN
      IF TG_OP = 'DELETE' THEN
        brand_id_value := OLD.brand_id;
      ELSE
        brand_id_value := NEW.brand_id;
      END IF;

    -- =============================================
    -- Product-level tables (via product_id → products.brand_id)
    -- =============================================
    WHEN 'product_variants', 'product_commercial', 'product_weight',
         'product_materials', 'product_eco_claims', 'product_environment',
         'product_journey_steps', 'product_tags' THEN
      -- Get product_id from appropriate record
      IF TG_OP = 'DELETE' THEN
        ref_product_id := OLD.product_id;
      ELSE
        ref_product_id := NEW.product_id;
      END IF;
      -- Lookup brand_id via products table
      SELECT p.brand_id INTO brand_id_value
      FROM public.products p
      WHERE p.id = ref_product_id;

    -- =============================================
    -- Variant-level tables (via variant_id → product_variants → products.brand_id)
    -- =============================================
    WHEN 'product_variant_attributes', 'variant_commercial', 'variant_weight',
         'variant_materials', 'variant_eco_claims', 'variant_environment',
         'variant_journey_steps' THEN
      -- Get variant_id from appropriate record
      IF TG_OP = 'DELETE' THEN
        ref_variant_id := OLD.variant_id;
      ELSE
        ref_variant_id := NEW.variant_id;
      END IF;
      -- Lookup brand_id via product_variants → products
      SELECT p.brand_id INTO brand_id_value
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = ref_variant_id;

    -- =============================================
    -- Integration tables (via brand_integration_id → brand_integrations.brand_id)
    -- =============================================
    WHEN 'integration_sync_jobs', 'integration_field_configs',
         'integration_product_links', 'integration_variant_links' THEN
      -- Get brand_integration_id from appropriate record
      IF TG_OP = 'DELETE' THEN
        ref_integration_id := OLD.brand_integration_id;
      ELSE
        ref_integration_id := NEW.brand_integration_id;
      END IF;
      -- Lookup brand_id via brand_integrations
      SELECT bi.brand_id INTO brand_id_value
      FROM public.brand_integrations bi
      WHERE bi.id = ref_integration_id;

    ELSE
      -- Unknown table, skip broadcast with warning
      RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no brand_id resolution configured', TG_TABLE_NAME;
      RETURN NULL;
  END CASE;

  -- Skip if no brand_id could be resolved
  IF brand_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- =============================================
  -- STEP 2: Map table to domain
  -- =============================================
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

  -- Skip broadcast for unknown domains
  IF domain_name = 'unknown' THEN
    RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no domain mapping configured', TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  -- =============================================
  -- STEP 3: Broadcast the change based on operation type
  -- Pass NULL for non-existent records to avoid errors
  -- =============================================
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
  'Broadcasts domain-specific changes for realtime updates. Correctly handles DELETE operations and resolves brand_id through foreign keys for child tables.';
