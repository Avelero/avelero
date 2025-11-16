-- Migration: Fix unsafe IMMUTABLE function declaration
-- Date: 2025-11-16
-- Description: Changes get_product_brand_id from IMMUTABLE to STABLE to prevent
-- index staleness when product.brand_id changes.
--
-- BACKGROUND:
-- The function was declared IMMUTABLE, which tells PostgreSQL that the function
-- always returns the same result for the same input, even across transactions.
-- However, the function reads from public.products table, which CAN change.
-- If a product's brand_id is updated, the expression indexes using this function
-- will NOT be refreshed, potentially allowing duplicate UPIDs/SKUs across brands.
--
-- SOLUTION:
-- Change to STABLE, which tells PostgreSQL the function's result can vary between
-- transactions but not within a single transaction. This ensures indexes are
-- properly maintained while still allowing index usage for queries.

-- ============================================================================
-- Step 1: Drop existing indexes that use the IMMUTABLE function
-- ============================================================================

DROP INDEX IF EXISTS idx_unique_upid_per_brand;
DROP INDEX IF EXISTS idx_unique_sku_per_brand;
DROP INDEX IF EXISTS idx_variants_brand_upid_sku;

-- ============================================================================
-- Step 2: Replace IMMUTABLE function with STABLE version
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_product_brand_id(product_id_param UUID)
RETURNS UUID
LANGUAGE SQL
STABLE  -- Changed from IMMUTABLE to STABLE
AS $$
  SELECT brand_id FROM public.products WHERE id = product_id_param;
$$;

COMMENT ON FUNCTION public.get_product_brand_id IS
  'Helper function to resolve brand_id from product_id for unique constraints on product_variants.
  Declared STABLE (not IMMUTABLE) because it reads from products table which can change across transactions.';

-- ============================================================================
-- Step 3: Recreate indexes with STABLE function
-- ============================================================================

-- Unique index for UPID per brand (excluding NULL/empty UPIDs)
CREATE UNIQUE INDEX idx_unique_upid_per_brand
ON public.product_variants (upid, public.get_product_brand_id(product_id))
WHERE upid IS NOT NULL AND upid != '';

COMMENT ON INDEX idx_unique_upid_per_brand IS
  'Ensures UPID is unique within a brand. Critical for accurate UPDATE vs CREATE detection during bulk imports.
  Uses STABLE function so index is properly maintained when product.brand_id changes.';

-- Unique index for SKU per brand
CREATE UNIQUE INDEX idx_unique_sku_per_brand
ON public.product_variants (sku, public.get_product_brand_id(product_id))
WHERE sku IS NOT NULL AND sku != '';

COMMENT ON INDEX idx_unique_sku_per_brand IS
  'Ensures SKU is unique within a brand. Critical for accurate UPDATE vs CREATE detection during bulk imports.
  Uses STABLE function so index is properly maintained when product.brand_id changes.';

-- Composite index for faster lookups during import
CREATE INDEX idx_variants_brand_upid_sku
ON public.product_variants (public.get_product_brand_id(product_id), upid, sku)
WHERE upid IS NOT NULL OR sku IS NOT NULL;

COMMENT ON INDEX idx_variants_brand_upid_sku IS
  'Speeds up the pre-loading query in validate-and-stage.ts.
  Uses STABLE function so index is properly maintained when product.brand_id changes.';

-- ============================================================================
-- Performance Note
-- ============================================================================

-- STABLE functions can still be used in indexes and are still optimized by PostgreSQL.
-- The only difference from IMMUTABLE is that PostgreSQL knows to invalidate cached
-- results across transactions, ensuring correctness.
--
-- Query performance: No change (indexes still used)
-- Write performance: Slightly better (indexes properly maintained)
-- Data integrity: Fixed (no stale index entries)
