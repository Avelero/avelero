-- Migration: Remove duplicate indexes that shadow unique constraints
-- Date: 2025-11-16
-- Description: Removes indexes that duplicate existing unique constraints
-- Background: Unique constraints automatically create indexes, so separate indexes
-- on the same columns provide no benefit and add unnecessary write overhead

-- ============================================================================
-- Remove duplicate index for brand_colors (duplicates brand_colors_brand_name_unq)
-- ============================================================================

-- The unique constraint brand_colors_brand_name_unq already provides an index
-- on (brand_id, name), so this separate index is redundant
DROP INDEX IF EXISTS idx_brand_colors_brand_name;

-- Add comment if constraint exists
DO $$
BEGIN
  COMMENT ON CONSTRAINT brand_colors_brand_name_unq ON brand_colors IS
    'Unique constraint on (brand_id, name). This constraint automatically provides an index for lookups and sorting.';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================================================
-- Remove duplicate index for showcase_brands (duplicates showcase_brands_brand_name_unq)
-- ============================================================================

-- The unique constraint showcase_brands_brand_name_unq already provides an index
-- on (brand_id, name), so this separate index is redundant
DROP INDEX IF EXISTS idx_showcase_brands_brand_name;

-- Add comment if constraint exists
DO $$
BEGIN
  COMMENT ON CONSTRAINT showcase_brands_brand_name_unq ON showcase_brands IS
    'Unique constraint on (brand_id, name). This constraint automatically provides an index for lookups and sorting.';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================================================
-- Remove duplicate index for brand_seasons (duplicates brand_seasons_brand_name_unq)
-- ============================================================================

-- The unique constraint brand_seasons_brand_name_unq already provides an index
-- on (brand_id, name), so this separate index is redundant
DROP INDEX IF EXISTS idx_brand_seasons_brand_name;

-- Add comment if constraint exists
DO $$
BEGIN
  COMMENT ON CONSTRAINT brand_seasons_brand_name_unq ON brand_seasons IS
    'Unique constraint on (brand_id, name). This constraint automatically provides an index for lookups and sorting.';
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

-- ============================================================================
-- Keep the other indexes as they don't have corresponding unique constraints
-- ============================================================================

-- These indexes are NOT duplicates and should remain:
-- - idx_brand_materials_brand_name (no unique constraint)
-- - idx_brand_sizes_brand_name (no unique constraint)
-- - idx_brand_facilities_brand_display (no unique constraint)
-- - idx_brand_certifications_brand_title (no unique constraint)
-- - idx_categories_name (no unique constraint)

-- PERFORMANCE IMPACT:
-- Removing duplicate indexes reduces:
-- 1. Storage overhead (each duplicate index consumes disk space)
-- 2. Write overhead (each index must be updated on INSERT/UPDATE/DELETE)
-- 3. Maintenance overhead (vacuum, analyze must process each index)
-- No performance degradation as the unique constraint indexes remain

