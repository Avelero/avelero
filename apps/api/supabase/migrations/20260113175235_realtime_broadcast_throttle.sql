-- =============================================
-- REALTIME BROADCAST THROTTLE
-- =============================================
-- Implements database-level throttling for realtime broadcasts.
-- Only one broadcast per domain/brand_id per second is allowed.
-- This prevents message queue flooding during bulk operations.
--
-- Benefits:
-- 1. Prevents client overload during bulk updates (1000+ rows)
-- 2. Prevents realtime.messages table from growing too fast
-- 3. Works automatically for ALL operations (UI and background jobs)
-- 4. Uses advisory locks to prevent race conditions

-- Create throttle tracking table
CREATE TABLE IF NOT EXISTS realtime.broadcast_throttle (
  domain text NOT NULL,
  brand_id uuid NOT NULL,
  last_broadcast_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (domain, brand_id)
);

-- Explicitly disable RLS - this table is only accessed by SECURITY DEFINER trigger functions
-- and should never be accessed directly by users
ALTER TABLE realtime.broadcast_throttle DISABLE ROW LEVEL SECURITY;

-- Add comment
COMMENT ON TABLE realtime.broadcast_throttle IS
  'Tracks last broadcast timestamp per domain/brand to implement 1-second throttling. Internal table - no RLS.';

-- Create index for cleanup operations
CREATE INDEX IF NOT EXISTS broadcast_throttle_last_broadcast_idx 
  ON realtime.broadcast_throttle (last_broadcast_at);

-- Replace the trigger function with throttled version
CREATE OR REPLACE FUNCTION realtime.broadcast_domain_changes()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  brand_id_value uuid;
  domain_name text;
  record_data record;
  last_broadcast timestamptz;
  throttle_ms integer := 1000; -- 1 second throttle
  should_broadcast boolean := false;
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

  -- Skip unknown domains
  IF domain_name = 'unknown' THEN
    RETURN NULL;
  END IF;

  -- =============================================
  -- THROTTLE LOGIC
  -- =============================================
  -- Use advisory lock to prevent race conditions between concurrent transactions.
  -- pg_try_advisory_xact_lock returns FALSE immediately if lock is held by another transaction.
  -- The lock is automatically released when the transaction commits/rollbacks.
  
  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || brand_id_value::text)) THEN
    -- We acquired the lock, check if we should broadcast
    
    -- Get last broadcast time for this domain/brand
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND brand_id = brand_id_value;
    
    -- Broadcast if:
    -- 1. No previous broadcast exists (last_broadcast IS NULL), OR
    -- 2. Enough time has passed since last broadcast (>= throttle_ms)
    IF last_broadcast IS NULL OR 
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;
      
      -- Update/insert the throttle timestamp
      INSERT INTO realtime.broadcast_throttle (domain, brand_id, last_broadcast_at)
      VALUES (domain_name, brand_id_value, clock_timestamp())
      ON CONFLICT (domain, brand_id) 
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;
  -- If we couldn't get the lock, another transaction is handling this domain/brand

  -- Only broadcast if throttle allows
  IF should_broadcast THEN
    PERFORM realtime.broadcast_changes(
      domain_name || ':' || brand_id_value::text,  -- topic: e.g., "products:uuid"
      TG_OP,                                        -- event: INSERT/UPDATE/DELETE
      TG_OP,                                        -- operation
      TG_TABLE_NAME,                                -- table name
      TG_TABLE_SCHEMA,                              -- schema
      NEW,                                          -- new record
      OLD                                           -- old record
    );
  END IF;

  RETURN NULL;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION realtime.broadcast_domain_changes() IS
  'Broadcasts domain-specific changes for realtime updates with 1-second throttling per domain/brand. Resolves brand_id through foreign keys for tables without direct brand_id column. Uses advisory locks to prevent race conditions.';

-- Create a cleanup function to remove old throttle entries (optional maintenance)
CREATE OR REPLACE FUNCTION realtime.cleanup_broadcast_throttle()
RETURNS void
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Remove entries older than 1 hour (they're no longer needed for throttling)
  DELETE FROM realtime.broadcast_throttle
  WHERE last_broadcast_at < now() - interval '1 hour';
END;
$$;

COMMENT ON FUNCTION realtime.cleanup_broadcast_throttle() IS
  'Removes stale throttle entries older than 1 hour. Can be run periodically via pg_cron.';
