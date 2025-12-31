-- Migration: Add is_canonical column to integration_product_links
-- This is a minimal migration that only includes essential schema changes.
-- Index/FK renaming and RLS policy updates have been removed as they were
-- causing errors due to drizzle-kit introspection limitations.

-- Drop staging_product_tags table (if it exists in schema but was removed)
DROP TABLE IF EXISTS "staging_product_tags" CASCADE;

-- Add is_canonical column to integration_product_links
ALTER TABLE "integration_product_links" ADD COLUMN IF NOT EXISTS "is_canonical" boolean DEFAULT true NOT NULL;