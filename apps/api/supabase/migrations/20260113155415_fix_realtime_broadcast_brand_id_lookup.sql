-- =============================================
-- FIX: REALTIME BROADCAST TRIGGER BRAND_ID LOOKUP
-- =============================================
-- The original trigger assumed all tables have a direct brand_id column.
-- This update handles tables that need to lookup brand_id through foreign keys.
--
-- Tables with indirect brand_id resolution:
-- 1. product_* tables (except products) → via product_id → products.brand_id
-- 2. variant_* tables → via variant_id → product_variants.product_id → products.brand_id
-- 3. integration_* tables (except brand_integrations) → via brand_integration_id → brand_integrations.brand_id
-- 4. product_variant_attributes → via variant_id → product_variants → products.brand_id

-- Replace the trigger function with brand_id resolution logic
CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  brand_id_value uuid;
  domain_name text;
  record_data record;
BEGIN
  -- Use NEW for INSERT/UPDATE, OLD for DELETE
  record_data := COALESCE(NEW, OLD);

  -- Resolve brand_id based on table structure
  CASE TG_TABLE_NAME
    -- Tables with direct brand_id column
    WHEN 'products', 'brand_materials', 'brand_tags', 'brand_eco_claims',
         'brand_attributes', 'brand_attribute_values', 'brand_seasons',
         'brand_manufacturers', 'brand_facilities', 'brand_certifications',
         'brand_integrations', 'brand_members', 'brand_invites',
         'import_jobs', 'export_jobs', 'brand_theme', 'brand_collections' THEN
      brand_id_value := record_data.brand_id;

    -- Product-level tables (via product_id → products.brand_id)
    WHEN 'product_variants', 'product_commercial', 'product_weight',
         'product_materials', 'product_eco_claims', 'product_environment',
         'product_journey_steps', 'product_tags' THEN
      SELECT p.brand_id INTO brand_id_value
      FROM public.products p
      WHERE p.id = record_data.product_id;

    -- Variant-level tables (via variant_id → product_variants → products.brand_id)
    WHEN 'product_variant_attributes', 'variant_commercial', 'variant_weight',
         'variant_materials', 'variant_eco_claims', 'variant_environment',
         'variant_journey_steps' THEN
      SELECT p.brand_id INTO brand_id_value
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = record_data.variant_id;

    -- Integration tables (via brand_integration_id → brand_integrations.brand_id)
    WHEN 'integration_sync_jobs', 'integration_field_configs',
         'integration_product_links', 'integration_variant_links' THEN
      SELECT bi.brand_id INTO brand_id_value
      FROM public.brand_integrations bi
      WHERE bi.id = record_data.brand_integration_id;

    ELSE
      -- Unknown table, skip broadcast
      RETURN NULL;
  END CASE;

  -- Skip if no brand_id could be resolved
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

-- Add comment explaining the function
COMMENT ON FUNCTION realtime.broadcast_domain_changes() IS
  'Broadcasts domain-specific changes for realtime updates. Resolves brand_id through foreign keys for tables without direct brand_id column.';
