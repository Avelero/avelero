-- =============================================
-- REALTIME BROADCAST AUTHORIZATION
-- =============================================

-- Enable authenticated users to receive broadcast messages
CREATE POLICY "Authenticated users can receive broadcasts"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- =============================================
-- BROADCAST TRIGGER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
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
-- TRIGGERS FOR ALL TABLES
-- =============================================

-- Products domain (16 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON products
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_commercial
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_weight
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_materials
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_eco_claims
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_environment
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_journey_steps
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_tags
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON product_variant_attributes
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_commercial
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_weight
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_materials
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_eco_claims
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_environment
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON variant_journey_steps
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();

-- Catalog domain (9 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_materials
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_tags
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_eco_claims
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_attributes
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_attribute_values
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_seasons
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_manufacturers
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_facilities
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_certifications
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();

-- Integrations domain (5 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_integrations
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON integration_sync_jobs
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON integration_field_configs
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON integration_product_links
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON integration_variant_links
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();

-- Team domain (2 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_members
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_invites
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();

-- Jobs domain (2 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON import_jobs
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();

-- Theme domain (2 tables)
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_theme
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
CREATE TRIGGER broadcast_changes AFTER INSERT OR UPDATE OR DELETE ON brand_collections
  FOR EACH ROW EXECUTE FUNCTION realtime.broadcast_domain_changes();
