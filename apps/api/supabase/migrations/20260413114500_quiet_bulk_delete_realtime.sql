-- =============================================
-- ALLOW TRANSACTION-LOCAL REALTIME BROADCAST SUPPRESSION
--
-- Bulk background deletes should emit one authoritative BULK_DELETE event
-- after the worker has finished, instead of flooding clients with throttled
-- per-row broadcasts while chunk deletes are still in flight.
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
  ref_product_id uuid;
  ref_variant_id uuid;
  ref_integration_id uuid;
  last_broadcast timestamptz;
  throttle_ms integer := 1000;
  should_broadcast boolean := false;
BEGIN
  IF current_setting('app.skip_realtime_broadcast', true) = 'on' THEN
    RETURN NULL;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'products', 'brand_materials', 'brand_tags', 'brand_eco_claims',
         'brand_attributes', 'brand_attribute_values', 'brand_seasons',
         'brand_manufacturers', 'brand_operators', 'brand_certifications',
         'brand_integrations', 'brand_members', 'brand_invites',
         'import_jobs', 'export_jobs', 'brand_theme', 'brand_collections',
         'notifications' THEN
      IF TG_OP = 'DELETE' THEN
        brand_id_value := OLD.brand_id;
      ELSE
        brand_id_value := NEW.brand_id;
      END IF;

    WHEN 'product_variants', 'product_commercial', 'product_weight',
         'product_materials', 'product_eco_claims', 'product_environment',
         'product_journey_steps', 'product_tags' THEN
      IF TG_OP = 'DELETE' THEN
        ref_product_id := OLD.product_id;
      ELSE
        ref_product_id := NEW.product_id;
      END IF;

      SELECT p.brand_id INTO brand_id_value
      FROM public.products p
      WHERE p.id = ref_product_id;

    WHEN 'product_variant_attributes', 'variant_commercial', 'variant_weight',
         'variant_materials', 'variant_eco_claims', 'variant_environment',
         'variant_journey_steps' THEN
      IF TG_OP = 'DELETE' THEN
        ref_variant_id := OLD.variant_id;
      ELSE
        ref_variant_id := NEW.variant_id;
      END IF;

      SELECT p.brand_id INTO brand_id_value
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = ref_variant_id;

    WHEN 'integration_sync_jobs', 'integration_field_configs',
         'integration_product_links', 'integration_variant_links' THEN
      IF TG_OP = 'DELETE' THEN
        ref_integration_id := OLD.brand_integration_id;
      ELSE
        ref_integration_id := NEW.brand_integration_id;
      END IF;

      SELECT bi.brand_id INTO brand_id_value
      FROM public.brand_integrations bi
      WHERE bi.id = ref_integration_id;

    ELSE
      RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no brand_id resolution configured', TG_TABLE_NAME;
      RETURN NULL;
  END CASE;

  IF brand_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  domain_name := CASE TG_TABLE_NAME
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
    WHEN 'brand_materials' THEN 'catalog'
    WHEN 'brand_tags' THEN 'catalog'
    WHEN 'brand_eco_claims' THEN 'catalog'
    WHEN 'brand_attributes' THEN 'catalog'
    WHEN 'brand_attribute_values' THEN 'catalog'
    WHEN 'brand_seasons' THEN 'catalog'
    WHEN 'brand_manufacturers' THEN 'catalog'
    WHEN 'brand_operators' THEN 'catalog'
    WHEN 'brand_certifications' THEN 'catalog'
    WHEN 'brand_integrations' THEN 'integrations'
    WHEN 'integration_sync_jobs' THEN 'integrations'
    WHEN 'integration_field_configs' THEN 'integrations'
    WHEN 'integration_product_links' THEN 'integrations'
    WHEN 'integration_variant_links' THEN 'integrations'
    WHEN 'brand_members' THEN 'team'
    WHEN 'brand_invites' THEN 'team'
    WHEN 'import_jobs' THEN 'jobs'
    WHEN 'export_jobs' THEN 'jobs'
    WHEN 'brand_theme' THEN 'theme'
    WHEN 'brand_collections' THEN 'theme'
    WHEN 'notifications' THEN 'notifications'
    ELSE 'unknown'
  END;

  IF domain_name = 'unknown' THEN
    RAISE WARNING 'realtime.broadcast_domain_changes: Table % has no domain mapping configured', TG_TABLE_NAME;
    RETURN NULL;
  END IF;

  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || brand_id_value::text)) THEN
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND scope_id = brand_id_value;

    IF last_broadcast IS NULL OR
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;

      INSERT INTO realtime.broadcast_throttle (domain, scope_id, last_broadcast_at)
      VALUES (domain_name, brand_id_value, clock_timestamp())
      ON CONFLICT (domain, scope_id)
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;

  IF should_broadcast THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM realtime.broadcast_changes(
        domain_name || ':' || brand_id_value::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NULL::record,
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
        NULL::record
      );
    ELSE
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
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION realtime.broadcast_domain_changes() IS
  'Broadcasts domain-specific changes for realtime updates with 1-second throttling per domain/scope. Supports a transaction-local app.skip_realtime_broadcast flag for bulk jobs that emit one authoritative event after completion.';
