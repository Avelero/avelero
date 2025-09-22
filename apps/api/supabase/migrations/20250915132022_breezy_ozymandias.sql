ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_certifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_colors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_facilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_sizes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "care_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "showcase_brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variant_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_care_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "file_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "value_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "categories_select_for_authenticated" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "categories_modify_system_only" ON "categories" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "brand_certifications_select_for_brand_members" ON "brand_certifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_insert_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_update_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_delete_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_select_for_brand_members" ON "brand_collections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_insert_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_update_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_delete_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_select_for_brand_members" ON "brand_colors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_insert_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_update_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_delete_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_select_for_brand_members" ON "brand_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_insert_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_update_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_delete_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_select_for_brand_members" ON "brand_facilities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_insert_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_update_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_delete_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_select_for_brand_members" ON "brand_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_insert_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_update_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_delete_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_select_for_brand_members" ON "brand_services" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_insert_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_update_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_delete_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_select_for_brand_members" ON "brand_sizes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_insert_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_update_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_delete_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "care_codes_select_for_authenticated" ON "care_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "care_codes_modify_system_only" ON "care_codes" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "showcase_brands_select_for_brand_members" ON "showcase_brands" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_insert_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_update_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_delete_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "products_select_for_brand_members" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "products_insert_by_brand_owner" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "products_update_by_brand_owner" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "products_delete_by_brand_owner" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "product_variants_select_for_brand_members" ON "product_variants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_insert_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_update_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_delete_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_materials_select_for_brand_members" ON "product_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_insert_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_update_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_delete_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_select_for_brand_members" ON "product_journey_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_insert_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_update_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_delete_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_environment_select_for_brand_members" ON "product_environment" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_insert_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_update_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_delete_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_identifiers_select_for_brand_members" ON "product_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_insert_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_update_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_delete_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_select_for_brand_members" ON "product_variant_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_insert_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_update_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_delete_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_select_for_brand_members" ON "product_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_insert_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_update_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_delete_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_select_for_brand_members" ON "product_care_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_insert_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_update_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_delete_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "file_assets_select_for_brand_members" ON "file_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((brand_id IS NULL) OR is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_insert_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_update_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_delete_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_select_for_brand_members" ON "import_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_insert_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_update_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_delete_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_rows_select_for_brand_members" ON "import_rows" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_insert_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_update_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_delete_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "value_mappings_select_for_brand_members" ON "value_mappings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_insert_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_update_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_delete_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));