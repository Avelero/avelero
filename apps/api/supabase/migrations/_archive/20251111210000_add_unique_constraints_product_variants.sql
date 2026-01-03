-- ============================================================================
-- MIGRATION: Add unique constraints to product_variants
-- ============================================================================
-- This migration adds unique constraints for UPID and SKU per brand
-- to ensure accurate UPDATE vs CREATE detection during bulk imports.
--
-- Date: November 11, 2025
-- ============================================================================

-- Step 1: Check for existing duplicates
-- This will show you any duplicate UPIDs or SKUs that need to be cleaned up first
SELECT 'Checking for duplicate UPIDs...' as status;

SELECT pv.upid, p.brand_id, COUNT(*) as duplicate_count
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.upid IS NOT NULL AND pv.upid != ''
GROUP BY pv.upid, p.brand_id
HAVING COUNT(*) > 1;

SELECT 'Checking for duplicate SKUs...' as status;

SELECT pv.sku, p.brand_id, COUNT(*) as duplicate_count
FROM public.product_variants pv
JOIN public.products p ON pv.product_id = p.id
WHERE pv.sku IS NOT NULL AND pv.sku != ''
GROUP BY pv.sku, p.brand_id
HAVING COUNT(*) > 1;

-- Step 2: Create helper function to get brand_id from product_id
-- This is needed because we can't directly reference products.brand_id in a unique constraint
-- IMPORTANT: Function MUST be IMMUTABLE to be used in indexes
CREATE OR REPLACE FUNCTION public.get_product_brand_id(product_id_param UUID)
RETURNS UUID
LANGUAGE SQL
IMMUTABLE
AS $$
  SELECT brand_id FROM public.products WHERE id = product_id_param;
$$;

COMMENT ON FUNCTION public.get_product_brand_id IS 
  'Helper function to resolve brand_id from product_id for unique constraints on product_variants.';

-- Step 3: Add unique index for UPID per brand (excluding NULL/empty UPIDs)
-- Using IF NOT EXISTS to make it idempotent
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_upid_per_brand
ON public.product_variants (upid, public.get_product_brand_id(product_id))
WHERE upid IS NOT NULL AND upid != '';

COMMENT ON INDEX idx_unique_upid_per_brand IS 
  'Ensures UPID is unique within a brand. Critical for accurate UPDATE vs CREATE detection during bulk imports.';

-- Step 4: Add unique index for SKU per brand
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_sku_per_brand
ON public.product_variants (sku, public.get_product_brand_id(product_id))
WHERE sku IS NOT NULL AND sku != '';

COMMENT ON INDEX idx_unique_sku_per_brand IS 
  'Ensures SKU is unique within a brand. Critical for accurate UPDATE vs CREATE detection during bulk imports.';

-- Step 5: Add composite index for faster lookups during import
-- This speeds up the pre-loading query in validate-and-stage.ts
CREATE INDEX IF NOT EXISTS idx_variants_brand_upid_sku
ON public.product_variants (public.get_product_brand_id(product_id), upid, sku)
WHERE upid IS NOT NULL OR sku IS NOT NULL;

-- Done!
SELECT 'Migration completed successfully!' as status;
SELECT 'Unique constraints added for UPID and SKU per brand' as message;
