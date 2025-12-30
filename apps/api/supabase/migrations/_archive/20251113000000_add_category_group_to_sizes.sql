-- Add category_group column to brand_sizes table
-- This migration supports the new size creation flow where users select gender + subgroup
-- Valid category groups: mens-tops, mens-bottoms, mens-outerwear, mens-footwear, mens-accessories,
--                        womens-tops, womens-bottoms, womens-dresses, womens-outerwear, womens-footwear, womens-accessories

-- Step 1: Add the new category_group column
ALTER TABLE brand_sizes 
ADD COLUMN IF NOT EXISTS category_group TEXT;

-- Step 2: Add check constraint to ensure only valid category groups
ALTER TABLE brand_sizes
ADD CONSTRAINT brand_sizes_category_group_check
CHECK (
  category_group IS NULL OR
  category_group IN (
    'mens-tops',
    'mens-bottoms',
    'mens-outerwear',
    'mens-footwear',
    'mens-accessories',
    'womens-tops',
    'womens-bottoms',
    'womens-dresses',
    'womens-outerwear',
    'womens-footwear',
    'womens-accessories'
  )
);

-- Step 3: Create new unique index for brand_id + name + category_group
-- This allows same size name in different category groups
CREATE UNIQUE INDEX IF NOT EXISTS brand_sizes_brand_name_group_unq
ON brand_sizes(brand_id, name, category_group)
WHERE category_group IS NOT NULL;

-- Step 4: Add index for efficient filtering by category_group
CREATE INDEX IF NOT EXISTS idx_brand_sizes_category_group
ON brand_sizes(brand_id, category_group)
WHERE category_group IS NOT NULL;

-- Step 5: Create partial unique index for backward compatibility
-- Ensures uniqueness for sizes without category_group (legacy data)
CREATE UNIQUE INDEX IF NOT EXISTS brand_sizes_brand_name_legacy_unq
ON brand_sizes(brand_id, name, category_id)
WHERE category_group IS NULL AND category_id IS NOT NULL;

-- Step 6: Add comment explaining the new field
COMMENT ON COLUMN brand_sizes.category_group IS 
'Category group key in format "gender-subgroup" (e.g., "mens-tops", "womens-bottoms"). Primary field for new size creation flow. Replaces direct category_id references.';

-- MIGRATION NOTES:
-- - The category_id column is kept for backward compatibility
-- - New size creations should use category_group
-- - Existing sizes with category_id can continue to work
-- - The unique constraint allows same size name across different category groups
-- - Data migration to populate category_group from existing category_id values should be done separately if needed

-- PERFORMANCE IMPACT:
-- - New indexes improve filtering by category_group
-- - Minimal impact on existing queries using category_id
-- - Partial indexes reduce index size and improve write performance

