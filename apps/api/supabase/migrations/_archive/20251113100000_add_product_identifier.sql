-- ============================================================================
-- MIGRATION: Add product_identifier to products and make SKU optional in variants
-- ============================================================================
-- This migration implements a new product identification strategy:
-- 1. Products are identified by unique product_identifier (per brand)
-- 2. SKU becomes optional at the variant level
-- 3. Variants are auto-generated based on color × size combinations
--
-- Date: November 13, 2025
-- ============================================================================

-- Step 1: Add product_identifier column to products table
-- For existing products without a product_identifier, we'll need to generate one
-- Using a placeholder pattern: PROD-{first 8 chars of UUID}
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS product_identifier TEXT;

-- Step 2: Populate product_identifier for existing products
-- Generate identifiers from existing data or UUID
UPDATE products 
SET product_identifier = CONCAT('PROD-', SUBSTRING(id::text, 1, 8))
WHERE product_identifier IS NULL;

-- Step 3: Make product_identifier NOT NULL after populating
ALTER TABLE products 
ALTER COLUMN product_identifier SET NOT NULL;

-- Step 4: Add unique index for product_identifier per brand
CREATE UNIQUE INDEX IF NOT EXISTS products_brand_id_product_identifier_unq
ON products(brand_id, product_identifier);

-- Step 5: Add index for efficient product_identifier lookups
CREATE INDEX IF NOT EXISTS idx_products_brand_product_identifier
ON products(brand_id, product_identifier);

-- Step 6: Make SKU optional in product_variants
-- First, populate NULL for any missing SKUs (shouldn't be any, but safety measure)
UPDATE product_variants 
SET sku = CONCAT('VAR-', SUBSTRING(id::text, 1, 8))
WHERE sku IS NULL OR sku = '';

-- Step 7: Drop the NOT NULL constraint on SKU
ALTER TABLE product_variants 
ALTER COLUMN sku DROP NOT NULL;

-- Step 8: Add comment explaining the new field
COMMENT ON COLUMN products.product_identifier IS 
  'Unique product identifier within the brand. Primary identifier for products, replacing SKU-based identification. Used for matching, tracking, and generating variants.';

COMMENT ON COLUMN product_variants.sku IS 
  'Stock Keeping Unit (optional). Can be used for variant-specific tracking but is no longer required. Product identification is now handled at the product level via product_identifier.';

-- ============================================================================
-- MIGRATION NOTES
-- ============================================================================
-- This migration changes the product identification model:
--
-- OLD MODEL (SKU-based):
-- - SKU was required at variant level
-- - SKU was used to identify products
-- - Creating product meant specifying SKU per variant
--
-- NEW MODEL (product_identifier-based):
-- - product_identifier required at product level
-- - SKU is optional at variant level  
-- - Variants auto-generated from color × size combinations
-- - Each variant gets unique UUID
--
-- EXAMPLE:
-- Product: "Classic T-Shirt" (product_identifier: "TSHIRT-001")
-- Colors: Blue, Red
-- Sizes: S, M, L
-- Results in 6 variants:
--   - Blue + S (auto-generated UUID)
--   - Blue + M (auto-generated UUID)
--   - Blue + L (auto-generated UUID)
--   - Red + S (auto-generated UUID)
--   - Red + M (auto-generated UUID)
--   - Red + L (auto-generated UUID)
--
-- SKU and EAN can still be added to variants for tracking purposes
-- ============================================================================

-- Step 9: Create helper function to find product by identifier
CREATE OR REPLACE FUNCTION public.get_product_by_identifier(
  brand_id_param UUID,
  product_identifier_param TEXT
)
RETURNS UUID
LANGUAGE SQL
STABLE
AS $$
  SELECT id 
  FROM public.products 
  WHERE brand_id = brand_id_param 
    AND product_identifier = product_identifier_param
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_product_by_identifier IS 
  'Helper function to resolve product ID from brand_id and product_identifier. Used in bulk imports and API queries.';

-- ============================================================================
-- DATA VALIDATION
-- ============================================================================
-- Verify all products now have product_identifier
DO $$
DECLARE
  missing_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO missing_count
  FROM products
  WHERE product_identifier IS NULL;
  
  IF missing_count > 0 THEN
    RAISE WARNING '% products are missing product_identifier', missing_count;
  ELSE
    RAISE NOTICE 'All products have product_identifier - migration successful';
  END IF;
END $$;

