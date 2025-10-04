-- CREATE TYPE "public"."user_role" AS ENUM('owner', 'member');--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- DROP INDEX "idx_users_avatar_hue";--> statement-breakpoint
-- ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
-- DROP POLICY "users_insert_by_service" ON "users" CASCADE;--> statement-breakpoint
-- DROP POLICY "select_own_profile" ON "users" CASCADE;--> statement-breakpoint
-- DROP POLICY "update_own_profile" ON "users" CASCADE;--> statement-breakpoint
-- DROP POLICY "users_select_for_brand_members" ON "users" CASCADE;--> statement-breakpoint
ALTER POLICY "brand_certifications_insert_by_brand_owner" ON "brand_certifications" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_certifications_update_by_brand_owner" ON "brand_certifications" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_certifications_delete_by_brand_owner" ON "brand_certifications" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_insert_by_brand_owner" ON "brand_colors" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_update_by_brand_owner" ON "brand_colors" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_delete_by_brand_owner" ON "brand_colors" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_insert_by_brand_owner" ON "brand_eco_claims" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_update_by_brand_owner" ON "brand_eco_claims" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_delete_by_brand_owner" ON "brand_eco_claims" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_insert_by_brand_owner" ON "brand_facilities" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_update_by_brand_owner" ON "brand_facilities" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_delete_by_brand_owner" ON "brand_facilities" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_insert_by_brand_owner" ON "brand_materials" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_update_by_brand_owner" ON "brand_materials" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_delete_by_brand_owner" ON "brand_materials" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_insert_by_brand_owner" ON "brand_sizes" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_update_by_brand_owner" ON "brand_sizes" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_delete_by_brand_owner" ON "brand_sizes" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_insert_by_brand_owner" ON "products" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_update_by_brand_owner" ON "products" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_delete_by_brand_owner" ON "products" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "product_variants_insert_by_brand_owner" ON "product_variants" TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_variants_update_by_brand_owner" ON "product_variants" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_variants_delete_by_brand_owner" ON "product_variants" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_materials_insert_by_brand_owner" ON "product_materials" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_materials_update_by_brand_owner" ON "product_materials" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_materials_delete_by_brand_owner" ON "product_materials" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_insert_by_brand_owner" ON "product_journey_steps" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_update_by_brand_owner" ON "product_journey_steps" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_delete_by_brand_owner" ON "product_journey_steps" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_environment_insert_by_brand_owner" ON "product_environment" TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_environment_update_by_brand_owner" ON "product_environment" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_environment_delete_by_brand_owner" ON "product_environment" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_identifiers_insert_by_brand_owner" ON "product_identifiers" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_identifiers_update_by_brand_owner" ON "product_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_identifiers_delete_by_brand_owner" ON "product_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_insert_by_brand_owner" ON "product_variant_identifiers" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_update_by_brand_owner" ON "product_variant_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_delete_by_brand_owner" ON "product_variant_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_insert_by_brand_owner" ON "product_eco_claims" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_update_by_brand_owner" ON "product_eco_claims" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_delete_by_brand_owner" ON "product_eco_claims" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_insert_by_brand_owner" ON "product_care_codes" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_update_by_brand_owner" ON "product_care_codes" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_delete_by_brand_owner" ON "product_care_codes" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint

CREATE INDEX idx_products_brand_name ON products (brand_id, name);--> statement-breakpoint
CREATE INDEX idx_products_brand_category ON products (brand_id, category_id);--> statement-breakpoint
CREATE INDEX idx_products_brand_season ON products (brand_id, season);--> statement-breakpoint
CREATE INDEX idx_products_brand_created_at ON products (brand_id, created_at);--> statement-breakpoint
CREATE INDEX idx_products_brand_category_season ON products (brand_id, category_id, season);--> statement-breakpoint
-- CREATE INDEX idx_products_brand_status_date ON products (brand_id, status, published_at);--> statement-breakpoint
CREATE INDEX idx_products_cursor_pagination ON products (created_at DESC, id DESC);