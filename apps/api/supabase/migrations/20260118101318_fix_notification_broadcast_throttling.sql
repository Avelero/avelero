-- =============================================
-- FIX: Add throttling to user notifications broadcast
--
-- Problem: broadcast_user_notification() had no throttling, causing
-- 1000s of messages during bulk operations (imports, etc.)
--
-- Solution:
-- 1. Rename broadcast_throttle.brand_id -> scope_id (more generic)
-- 2. Update broadcast_domain_changes() to use scope_id
-- 3. Add throttle logic to broadcast_user_notification() using user_id as scope
--
-- The domain prefix already distinguishes scope type:
-- - products:uuid, jobs:uuid, etc. -> scope_id is brand_id
-- - notifications:uuid -> scope_id is user_id
-- =============================================

-- =============================================
-- STEP 1: Rename brand_id to scope_id in throttle table
-- =============================================

ALTER TABLE realtime.broadcast_throttle
  RENAME COLUMN brand_id TO scope_id;

-- Update table comment
COMMENT ON TABLE realtime.broadcast_throttle IS
  'Tracks last broadcast timestamp per domain/scope to implement 1-second throttling. Scope is brand_id for most domains, user_id for notifications. Internal table - no RLS.';

-- =============================================
-- STEP 2: Update broadcast_domain_changes() to use scope_id
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
  -- Throttle variables
  last_broadcast timestamptz;
  throttle_ms integer := 1000; -- 1 second throttle
  should_broadcast boolean := false;
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
    -- Product-level tables (via product_id -> products.brand_id)
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
    -- Variant-level tables (via variant_id -> product_variants -> products.brand_id)
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
      -- Lookup brand_id via product_variants -> products
      SELECT p.brand_id INTO brand_id_value
      FROM public.product_variants pv
      JOIN public.products p ON p.id = pv.product_id
      WHERE pv.id = ref_variant_id;

    -- =============================================
    -- Integration tables (via brand_integration_id -> brand_integrations.brand_id)
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
  -- STEP 3: THROTTLE LOGIC
  -- =============================================
  -- Use advisory lock to prevent race conditions between concurrent transactions.
  -- pg_try_advisory_xact_lock returns FALSE immediately if lock is held by another transaction.
  -- The lock is automatically released when the transaction commits/rollbacks.

  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || brand_id_value::text)) THEN
    -- We acquired the lock, check if we should broadcast

    -- Get last broadcast time for this domain/scope
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND scope_id = brand_id_value;

    -- Broadcast if:
    -- 1. No previous broadcast exists (last_broadcast IS NULL), OR
    -- 2. Enough time has passed since last broadcast (>= throttle_ms)
    IF last_broadcast IS NULL OR
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;

      -- Update/insert the throttle timestamp
      INSERT INTO realtime.broadcast_throttle (domain, scope_id, last_broadcast_at)
      VALUES (domain_name, brand_id_value, clock_timestamp())
      ON CONFLICT (domain, scope_id)
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;
  -- If we couldn't get the lock, another transaction is handling this domain/scope

  -- =============================================
  -- STEP 4: Broadcast the change based on operation type
  -- Only if throttle allows
  -- =============================================
  IF should_broadcast THEN
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
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION realtime.broadcast_domain_changes() IS
  'Broadcasts domain-specific changes for realtime updates with 1-second throttling per domain/scope. Correctly handles DELETE operations and resolves brand_id through foreign keys for child tables. Uses advisory locks and broadcast_throttle table to prevent message flooding during bulk operations.';

-- =============================================
-- STEP 3: Update broadcast_user_notification() with throttle logic
-- =============================================

CREATE OR REPLACE FUNCTION realtime.broadcast_user_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = realtime, public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  user_id_value uuid;
  domain_name text := 'notifications';
  -- Throttle variables
  last_broadcast timestamptz;
  throttle_ms integer := 1000; -- 1 second throttle
  should_broadcast boolean := false;
BEGIN
  -- Get user_id from new record (INSERT) or old record (DELETE)
  user_id_value := COALESCE(NEW.user_id, OLD.user_id);

  -- Skip if no user_id (shouldn't happen, but safety check)
  IF user_id_value IS NULL THEN
    RETURN NULL;
  END IF;

  -- =============================================
  -- THROTTLE LOGIC
  -- =============================================
  -- Use advisory lock to prevent race conditions between concurrent transactions.
  -- pg_try_advisory_xact_lock returns FALSE immediately if lock is held by another transaction.
  -- The lock is automatically released when the transaction commits/rollbacks.

  IF pg_try_advisory_xact_lock(hashtext(domain_name || ':' || user_id_value::text)) THEN
    -- We acquired the lock, check if we should broadcast

    -- Get last broadcast time for this domain/user (scope_id = user_id for notifications)
    SELECT last_broadcast_at INTO last_broadcast
    FROM realtime.broadcast_throttle
    WHERE domain = domain_name AND scope_id = user_id_value;

    -- Broadcast if:
    -- 1. No previous broadcast exists (last_broadcast IS NULL), OR
    -- 2. Enough time has passed since last broadcast (>= throttle_ms)
    IF last_broadcast IS NULL OR
       (EXTRACT(EPOCH FROM (clock_timestamp() - last_broadcast)) * 1000) >= throttle_ms THEN
      should_broadcast := true;

      -- Update/insert the throttle timestamp
      INSERT INTO realtime.broadcast_throttle (domain, scope_id, last_broadcast_at)
      VALUES (domain_name, user_id_value, clock_timestamp())
      ON CONFLICT (domain, scope_id)
      DO UPDATE SET last_broadcast_at = clock_timestamp();
    END IF;
  END IF;
  -- If we couldn't get the lock, another transaction is handling this user's notifications

  -- =============================================
  -- Broadcast to user-specific channel (only if throttle allows)
  -- =============================================
  -- Topic format: notifications:{user_id}
  -- Note: Full record is passed to broadcast_changes for flexibility.
  -- RLS policies on realtime.messages ensure users only receive their own notifications.

  IF should_broadcast THEN
    IF TG_OP = 'DELETE' THEN
      PERFORM realtime.broadcast_changes(
        'notifications:' || user_id_value::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NULL::record,
        OLD
      );
    ELSIF TG_OP = 'INSERT' THEN
      PERFORM realtime.broadcast_changes(
        'notifications:' || user_id_value::text,
        TG_OP,
        TG_OP,
        TG_TABLE_NAME,
        TG_TABLE_SCHEMA,
        NEW,
        NULL::record
      );
    ELSE -- UPDATE
      PERFORM realtime.broadcast_changes(
        'notifications:' || user_id_value::text,
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

COMMENT ON FUNCTION realtime.broadcast_user_notification() IS
  'Broadcasts user notification changes to user-specific realtime channels with 1-second throttling. Uses notifications:{user_id} topic format. Throttling prevents message flooding during bulk operations.';
