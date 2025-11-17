-- Migration: Add product-level UPID, tags system, colors hex, and products bucket
-- Date: 2025-11-16
-- Description:
-- 1. Add upid column to products table for product passport edit page slugs
-- 2. Create brand_tags and tags_on_product tables for product tagging
-- 3. Add hex column to brand_colors for color hex values
-- 4. Create products storage bucket with RLS policies
-- 5. Add status column to products table with proper validation

-- ============================================================================
-- 1. Add UPID column to products table
-- ============================================================================

-- Add upid column to products table
ALTER TABLE "products" ADD COLUMN "upid" text;

-- Create unique index for upid per brand (excluding NULL/empty UPIDs)
CREATE UNIQUE INDEX idx_products_brand_upid
ON "products" (brand_id, upid)
WHERE upid IS NOT NULL AND upid != '';

COMMENT ON COLUMN "products"."upid" IS 
  'Unique product identifier for product passport URLs (e.g., /passport/edit/{upid}). 
   16-character lowercase alphanumeric string. Must be unique within a brand.';

COMMENT ON INDEX idx_products_brand_upid IS
  'Ensures product UPID is unique within a brand. Used for product passport edit page routing.';

-- ============================================================================
-- 2. Create brand_tags table and tags_on_product junction table
-- ============================================================================

-- Create brand_tags table
CREATE TABLE IF NOT EXISTS "brand_tags" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "brand_id" uuid NOT NULL REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Unique constraint: tag name must be unique within each brand
CREATE UNIQUE INDEX brand_tags_brand_name_unq ON "brand_tags" (brand_id, name);

-- RLS policies for brand_tags
ALTER TABLE "brand_tags" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brand_tags_select_for_brand_members" ON "brand_tags" 
AS PERMISSIVE FOR SELECT TO authenticated 
USING (is_brand_member(brand_id));

CREATE POLICY "brand_tags_insert_by_brand_members" ON "brand_tags" 
AS PERMISSIVE FOR INSERT TO authenticated 
WITH CHECK (is_brand_member(brand_id));

CREATE POLICY "brand_tags_update_by_brand_members" ON "brand_tags" 
AS PERMISSIVE FOR UPDATE TO authenticated 
USING (is_brand_member(brand_id));

CREATE POLICY "brand_tags_delete_by_brand_members" ON "brand_tags" 
AS PERMISSIVE FOR DELETE TO authenticated 
USING (is_brand_member(brand_id));

-- Create tags_on_product junction table
CREATE TABLE IF NOT EXISTS "tags_on_product" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tag_id" uuid NOT NULL REFERENCES "brand_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "product_id" uuid NOT NULL REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Unique constraint: prevent duplicate tag assignments
CREATE UNIQUE INDEX tags_on_product_tag_product_unq ON "tags_on_product" (tag_id, product_id);

-- Indexes for efficient queries
CREATE INDEX tags_on_product_tag_id_idx ON "tags_on_product" (tag_id);
CREATE INDEX tags_on_product_product_id_idx ON "tags_on_product" (product_id);

-- RLS policies for tags_on_product (inherit brand access through products relationship)
ALTER TABLE "tags_on_product" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tags_on_product_select_for_brand_members" ON "tags_on_product"
AS PERMISSIVE FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND is_brand_member(products.brand_id)
  )
);

CREATE POLICY "tags_on_product_insert_by_brand_members" ON "tags_on_product"
AS PERMISSIVE FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND is_brand_member(products.brand_id)
  )
);

CREATE POLICY "tags_on_product_delete_by_brand_members" ON "tags_on_product"
AS PERMISSIVE FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM products 
    WHERE products.id = product_id 
    AND is_brand_member(products.brand_id)
  )
);

-- ============================================================================
-- 3. Add hex column to brand_colors table
-- ============================================================================

ALTER TABLE "brand_colors" ADD COLUMN "hex" text;

COMMENT ON COLUMN "brand_colors"."hex" IS 
  'Hex color value (e.g., #FF5733) for visual representation of the color.';

-- ============================================================================
-- 4. Add status column to products table with proper validation
-- ============================================================================

-- Add status column with default value
ALTER TABLE "products" ADD COLUMN "status" text DEFAULT 'unpublished' NOT NULL;

-- Add check constraint for valid statuses
ALTER TABLE "products" ADD CONSTRAINT products_status_check 
CHECK (status IN ('published', 'unpublished', 'archived', 'scheduled'));

COMMENT ON COLUMN "products"."status" IS 
  'Product publication status: published, unpublished, archived, or scheduled.';

-- ============================================================================
-- 5. Create products storage bucket with RLS policies
-- ============================================================================

-- Create products bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', false)
ON CONFLICT (id) DO UPDATE SET public = excluded.public;

-- RLS policies for products bucket
-- Path structure: {brand_id}/products/{product_id}/{filename}

-- Insert policy: brand members can upload
DROP POLICY IF EXISTS "Allow brand members upload products" ON storage.objects;
CREATE POLICY "Allow brand members upload products"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'products'
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- Select policy: brand members can view
DROP POLICY IF EXISTS "Allow brand members read products" ON storage.objects;
CREATE POLICY "Allow brand members read products"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- Update policy: brand members can update
DROP POLICY IF EXISTS "Allow brand members update products" ON storage.objects;
CREATE POLICY "Allow brand members update products"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_brand_member((path_tokens[1])::uuid)
)
WITH CHECK (
  bucket_id = 'products'
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- Delete policy: brand members can delete
DROP POLICY IF EXISTS "Allow brand members delete products" ON storage.objects;
CREATE POLICY "Allow brand members delete products"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'products'
  AND public.is_brand_member((path_tokens[1])::uuid)
);

-- ============================================================================
-- 6. Update staging_products table to include product upid
-- ============================================================================

ALTER TABLE "staging_products" ADD COLUMN "product_upid" text;

COMMENT ON COLUMN "staging_products"."product_upid" IS 
  'Product-level UPID for staging imports. Will be applied to products.upid during commit.';

-- ============================================================================
-- Summary
-- ============================================================================
-- Created:
-- - products.upid column with unique constraint per brand
-- - brand_tags table with RLS policies
-- - tags_on_product junction table with RLS policies
-- - brand_colors.hex column
-- - products.status column with validation
-- - products storage bucket with RLS policies
-- - staging_products.product_upid column

SELECT 'Migration completed: Added product UPID, tags system, colors hex, and products bucket' as message;
