-- Add performance indexes for catalog data queries used in bulk import
-- These indexes optimize the catalogData endpoint by speeding up brand-filtered lookups with name sorting

-- Index for brand_colors (brandId + name for sorting)
CREATE INDEX IF NOT EXISTS idx_brand_colors_brand_name
ON brand_colors(brand_id, name ASC);

-- Index for brand_materials (brandId + name for sorting)
CREATE INDEX IF NOT EXISTS idx_brand_materials_brand_name
ON brand_materials(brand_id, name ASC);

-- Index for brand_sizes (brandId + name for sorting)
CREATE INDEX IF NOT EXISTS idx_brand_sizes_brand_name
ON brand_sizes(brand_id, name ASC);

-- Index for brand_facilities (brandId + display_name for sorting)
CREATE INDEX IF NOT EXISTS idx_brand_facilities_brand_display
ON brand_facilities(brand_id, display_name ASC);

-- Index for showcase_brands (brandId + name for sorting)
CREATE INDEX IF NOT EXISTS idx_showcase_brands_brand_name
ON showcase_brands(brand_id, name ASC);

-- Index for brand_certifications (brandId + title for sorting)
CREATE INDEX IF NOT EXISTS idx_brand_certifications_brand_title
ON brand_certifications(brand_id, title ASC);

-- Index for categories (name for sorting - no brandId as it's global)
CREATE INDEX IF NOT EXISTS idx_categories_name
ON categories(name ASC);

-- Note: brand_seasons index is created in the add_brand_seasons migration

-- PERFORMANCE IMPACT:
-- These composite indexes (brandId + sortColumn) allow PostgreSQL to:
-- 1. Filter by brand_id efficiently (first column in index)
-- 2. Return results pre-sorted (second column in index)
-- 3. Use index-only scans when selecting just id and name
-- Expected speedup: 50-90% faster for large datasets (100+ rows per entity type)
