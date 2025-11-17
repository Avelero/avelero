-- Backend Redesign Migration
-- Implements changes specified in proposal.md

-- ============================================================================
-- 1. BRAND_FACILITIES TABLE CHANGES
-- ============================================================================

-- Drop contact column and vat_number
ALTER TABLE "brand_facilities" DROP COLUMN IF EXISTS "contact";
ALTER TABLE "brand_facilities" DROP COLUMN IF EXISTS "vat_number";

-- Rename address to address_line_1
ALTER TABLE "brand_facilities" RENAME COLUMN "address" TO "address_line_1";

-- Add new columns
ALTER TABLE "brand_facilities" ADD COLUMN IF NOT EXISTS "address_line_2" text;
ALTER TABLE "brand_facilities" ADD COLUMN IF NOT EXISTS "phone" text;
ALTER TABLE "brand_facilities" ADD COLUMN IF NOT EXISTS "email" text;
ALTER TABLE "brand_facilities" ADD COLUMN IF NOT EXISTS "state" text;
ALTER TABLE "brand_facilities" ADD COLUMN IF NOT EXISTS "zip" text;

-- ============================================================================
-- 2. BRAND_SIZES TABLE CHANGES
-- ============================================================================

-- Drop category_group column
ALTER TABLE "brand_sizes" DROP COLUMN IF EXISTS "category_group";

-- ============================================================================
-- 3. PRODUCT_VARIANTS TABLE CHANGES
-- ============================================================================

-- Drop columns from product_variants
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "sku";
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "product_image_url";
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "ean";
ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "status";

-- ============================================================================
-- 4. PRODUCTS TABLE CHANGES
-- ============================================================================

-- Drop columns from products
ALTER TABLE "products" DROP COLUMN IF EXISTS "season";
ALTER TABLE "products" DROP COLUMN IF EXISTS "brand_certification_id";
ALTER TABLE "products" DROP COLUMN IF EXISTS "additional_image_urls";
ALTER TABLE "products" DROP COLUMN IF EXISTS "tags";

-- Add template_id column to products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "template_id" uuid REFERENCES "passport_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================================
-- 5. STAGING_PRODUCT_VARIANTS TABLE CHANGES
-- ============================================================================

-- Drop columns from staging_product_variants to match production
ALTER TABLE "staging_product_variants" DROP COLUMN IF EXISTS "sku";
ALTER TABLE "staging_product_variants" DROP COLUMN IF EXISTS "product_image_url";
ALTER TABLE "staging_product_variants" DROP COLUMN IF EXISTS "ean";
ALTER TABLE "staging_product_variants" DROP COLUMN IF EXISTS "status";

-- ============================================================================
-- 6. STAGING_PRODUCTS TABLE CHANGES
-- ============================================================================

-- Drop columns from staging_products to match production
ALTER TABLE "staging_products" DROP COLUMN IF EXISTS "season";
ALTER TABLE "staging_products" DROP COLUMN IF EXISTS "brand_certification_id";
ALTER TABLE "staging_products" DROP COLUMN IF EXISTS "additional_image_urls";
ALTER TABLE "staging_products" DROP COLUMN IF EXISTS "tags";

-- ============================================================================
-- 7. TAGS_ON_PRODUCT TABLE CHANGES
-- ============================================================================

-- Add updated_at column
ALTER TABLE "tags_on_product" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- ============================================================================
-- 8. USERS TABLE CHANGES
-- ============================================================================

-- Drop role column (role is now defined in users_on_brand table)
ALTER TABLE "users" DROP COLUMN IF EXISTS "role";

-- Add service_role to existing RLS policies for users table
DO $$
BEGIN
  -- Drop existing policies if they exist
  DROP POLICY IF EXISTS "users_select_own_profile" ON "users";
  DROP POLICY IF EXISTS "users_select_for_brand_members" ON "users";
  DROP POLICY IF EXISTS "users_update_own_profile" ON "users";
  DROP POLICY IF EXISTS "users_insert_own_profile" ON "users";
END $$;

-- Recreate policies with service_role access
CREATE POLICY "users_select_own_profile"
  ON "users"
  FOR SELECT
  TO authenticated, service_role
  USING (auth.uid() = id);

CREATE POLICY "users_select_for_brand_members"
  ON "users"
  FOR SELECT
  TO authenticated, service_role
  USING (shares_brand_with(id));

CREATE POLICY "users_update_own_profile"
  ON "users"
  FOR UPDATE
  TO authenticated, service_role
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      brand_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM users_on_brand uob
        WHERE uob.brand_id = brand_id
          AND uob.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_insert_own_profile"
  ON "users"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (auth.uid() = id);

-- ============================================================================
-- 9. DROP DEPRECATED TABLES
-- ============================================================================

-- Drop product-level identifier and care code junction tables (no longer needed)
DROP TABLE IF EXISTS "staging_product_variant_identifiers" CASCADE;
DROP TABLE IF EXISTS "staging_product_identifiers" CASCADE;
DROP TABLE IF EXISTS "staging_product_care_codes" CASCADE;
DROP TABLE IF EXISTS "product_variant_identifiers" CASCADE;
DROP TABLE IF EXISTS "product_identifiers" CASCADE;
DROP TABLE IF EXISTS "product_care_codes" CASCADE;

-- Drop care codes table (care codes feature removed)
DROP TABLE IF EXISTS "care_codes" CASCADE;

-- Drop passport-related tables (passport logic moved to products)
DROP TABLE IF EXISTS "passport_module_completion" CASCADE;
DROP TABLE IF EXISTS "passports" CASCADE;

-- ============================================================================
-- 10. UPDATE RLS POLICIES TO ADD service_role
-- ============================================================================

-- Update brand_facilities RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "brand_facilities_select_for_brand_members" ON "brand_facilities";
  DROP POLICY IF EXISTS "brand_facilities_insert_by_brand_owner" ON "brand_facilities";
  DROP POLICY IF EXISTS "brand_facilities_update_by_brand_owner" ON "brand_facilities";
  DROP POLICY IF EXISTS "brand_facilities_delete_by_brand_owner" ON "brand_facilities";
END $$;

CREATE POLICY "brand_facilities_select_for_brand_members"
  ON "brand_facilities"
  FOR SELECT
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "brand_facilities_insert_by_brand_owner"
  ON "brand_facilities"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (is_brand_member(brand_id));

CREATE POLICY "brand_facilities_update_by_brand_owner"
  ON "brand_facilities"
  FOR UPDATE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "brand_facilities_delete_by_brand_owner"
  ON "brand_facilities"
  FOR DELETE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

-- Update brand_sizes RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "brand_sizes_select_for_brand_members" ON "brand_sizes";
  DROP POLICY IF EXISTS "brand_sizes_insert_by_brand_owner" ON "brand_sizes";
  DROP POLICY IF EXISTS "brand_sizes_update_by_brand_owner" ON "brand_sizes";
  DROP POLICY IF EXISTS "brand_sizes_delete_by_brand_owner" ON "brand_sizes";
END $$;

CREATE POLICY "brand_sizes_select_for_brand_members"
  ON "brand_sizes"
  FOR SELECT
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "brand_sizes_insert_by_brand_owner"
  ON "brand_sizes"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (is_brand_member(brand_id));

CREATE POLICY "brand_sizes_update_by_brand_owner"
  ON "brand_sizes"
  FOR UPDATE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "brand_sizes_delete_by_brand_owner"
  ON "brand_sizes"
  FOR DELETE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

-- Update products RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "products_select_for_brand_members" ON "products";
  DROP POLICY IF EXISTS "products_insert_by_brand_members" ON "products";
  DROP POLICY IF EXISTS "products_update_by_brand_members" ON "products";
  DROP POLICY IF EXISTS "products_delete_by_brand_members" ON "products";
END $$;

CREATE POLICY "products_select_for_brand_members"
  ON "products"
  FOR SELECT
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "products_insert_by_brand_members"
  ON "products"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (is_brand_member(brand_id));

CREATE POLICY "products_update_by_brand_members"
  ON "products"
  FOR UPDATE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

CREATE POLICY "products_delete_by_brand_members"
  ON "products"
  FOR DELETE
  TO authenticated, service_role
  USING (is_brand_member(brand_id));

-- Update product_variants RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "product_variants_select_for_brand_members" ON "product_variants";
  DROP POLICY IF EXISTS "product_variants_insert_by_brand_owner" ON "product_variants";
  DROP POLICY IF EXISTS "product_variants_update_by_brand_owner" ON "product_variants";
  DROP POLICY IF EXISTS "product_variants_delete_by_brand_owner" ON "product_variants";
END $$;

CREATE POLICY "product_variants_select_for_brand_members"
  ON "product_variants"
  FOR SELECT
  TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

CREATE POLICY "product_variants_insert_by_brand_owner"
  ON "product_variants"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

CREATE POLICY "product_variants_update_by_brand_owner"
  ON "product_variants"
  FOR UPDATE
  TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

CREATE POLICY "product_variants_delete_by_brand_owner"
  ON "product_variants"
  FOR DELETE
  TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

-- Update tags_on_product RLS policies
DO $$
BEGIN
  DROP POLICY IF EXISTS "tags_on_product_select_for_brand_members" ON "tags_on_product";
  DROP POLICY IF EXISTS "tags_on_product_insert_by_brand_members" ON "tags_on_product";
  DROP POLICY IF EXISTS "tags_on_product_delete_by_brand_members" ON "tags_on_product";
END $$;

CREATE POLICY "tags_on_product_select_for_brand_members"
  ON "tags_on_product"
  FOR SELECT
  TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

CREATE POLICY "tags_on_product_insert_by_brand_members"
  ON "tags_on_product"
  FOR INSERT
  TO authenticated, service_role
  WITH CHECK (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

CREATE POLICY "tags_on_product_delete_by_brand_members"
  ON "tags_on_product"
  FOR DELETE
  TO authenticated, service_role
  USING (EXISTS (
    SELECT 1 FROM products
    WHERE products.id = product_id
    AND is_brand_member(products.brand_id)
  ));

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
