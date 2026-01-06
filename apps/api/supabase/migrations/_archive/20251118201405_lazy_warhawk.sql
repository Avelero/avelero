DROP POLICY "passports_delete_by_brand_owner" ON "passports" CASCADE;--> statement-breakpoint
DROP POLICY "passports_insert_by_brand_owner" ON "passports" CASCADE;--> statement-breakpoint
DROP POLICY "passports_select_for_brand_members" ON "passports" CASCADE;--> statement-breakpoint
DROP POLICY "passports_update_by_brand_owner" ON "passports" CASCADE;--> statement-breakpoint
DROP TABLE "passports" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "passport_module_completion_delete_by_brand_owner" ON "passport_module_completion" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "passport_module_completion_insert_by_brand_owner" ON "passport_module_completion" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "passport_module_completion_select_for_brand_members" ON "passport_module_completion" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "passport_module_completion_update_by_brand_owner" ON "passport_module_completion" CASCADE;--> statement-breakpoint
DROP TABLE "passport_module_completion" CASCADE;--> statement-breakpoint
DROP POLICY "care_codes_modify_system_only" ON "care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "care_codes_select_for_authenticated" ON "care_codes" CASCADE;--> statement-breakpoint
DROP TABLE "care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "product_identifiers_delete_by_brand_owner" ON "product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_identifiers_insert_by_brand_owner" ON "product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_identifiers_select_for_brand_members" ON "product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_identifiers_update_by_brand_owner" ON "product_identifiers" CASCADE;--> statement-breakpoint
DROP TABLE "product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_variant_identifiers_delete_by_brand_owner" ON "product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_variant_identifiers_insert_by_brand_owner" ON "product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_variant_identifiers_select_for_brand_members" ON "product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_variant_identifiers_update_by_brand_owner" ON "product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP TABLE "product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "product_care_codes_delete_by_brand_owner" ON "product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "product_care_codes_insert_by_brand_owner" ON "product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "product_care_codes_select_for_brand_members" ON "product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "product_care_codes_update_by_brand_owner" ON "product_care_codes" CASCADE;--> statement-breakpoint
DROP TABLE "product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_care_codes_delete_by_system" ON "staging_product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_care_codes_insert_by_system" ON "staging_product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_care_codes_select_for_brand_members" ON "staging_product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_care_codes_update_by_system" ON "staging_product_care_codes" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_care_codes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_identifiers_delete_by_system" ON "staging_product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_identifiers_insert_by_system" ON "staging_product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_identifiers_select_for_brand_members" ON "staging_product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_identifiers_update_by_system" ON "staging_product_identifiers" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variant_identifiers_delete_by_system" ON "staging_product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variant_identifiers_insert_by_system" ON "staging_product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variant_identifiers_select_for_brand_members" ON "staging_product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variant_identifiers_update_by_system" ON "staging_product_variant_identifiers" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_variant_identifiers" CASCADE;--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_brand_certification_id_brand_certifications_id_fk";
--> statement-breakpoint
DROP INDEX "idx_brand_invites_valid_lookup";--> statement-breakpoint
DROP INDEX "categories_parent_id_idx";--> statement-breakpoint
DROP INDEX "categories_parent_name_unq";--> statement-breakpoint
DROP INDEX "brand_collections_brand_name_unq";--> statement-breakpoint
DROP INDEX "passport_template_modules_template_module_unq";--> statement-breakpoint
DROP INDEX "brand_colors_brand_name_unq";--> statement-breakpoint
DROP INDEX "brand_eco_claims_brand_claim_unq";--> statement-breakpoint
DROP INDEX "brand_services_brand_name_unq";--> statement-breakpoint
DROP INDEX "showcase_brands_brand_name_unq";--> statement-breakpoint
DROP INDEX "product_materials_product_material_unq";--> statement-breakpoint
DROP INDEX "product_journey_steps_product_sort_unq";--> statement-breakpoint
DROP INDEX "product_eco_claims_unique";--> statement-breakpoint
DROP INDEX "file_assets_bucket_path_unq";--> statement-breakpoint
DROP INDEX "import_rows_job_row_unq";--> statement-breakpoint
DROP INDEX "brand_sizes_brand_name_unq";--> statement-breakpoint
DROP INDEX "products_brand_id_product_identifier_unq";--> statement-breakpoint
DROP INDEX "brand_tags_brand_name_unq";--> statement-breakpoint
DROP INDEX "tags_on_product_product_id_idx";--> statement-breakpoint
DROP INDEX "tags_on_product_tag_id_idx";--> statement-breakpoint
DROP INDEX "tags_on_product_tag_product_unq";--> statement-breakpoint
DROP INDEX "brand_seasons_brand_name_unq";--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "email" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "website" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "address_line_1" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "address_line_2" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD COLUMN "zip" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "template_id" uuid;--> statement-breakpoint
ALTER TABLE "tags_on_product" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_template_id_passport_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."passport_templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_brand_invites_valid_lookup" ON "brand_invites" USING btree ("brand_id" uuid_ops,"expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_parent_name_unq" ON "categories" USING btree ("parent_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_collections_brand_name_unq" ON "brand_collections" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "passport_template_modules_template_module_unq" ON "passport_template_modules" USING btree ("template_id","module_key");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_colors_brand_name_unq" ON "brand_colors" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_eco_claims_brand_claim_unq" ON "brand_eco_claims" USING btree ("brand_id","claim");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_services_brand_name_unq" ON "brand_services" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "showcase_brands_brand_name_unq" ON "showcase_brands" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_materials_product_material_unq" ON "product_materials" USING btree ("product_id","brand_material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_journey_steps_product_sort_unq" ON "product_journey_steps" USING btree ("product_id","sort_index");--> statement-breakpoint
CREATE UNIQUE INDEX "product_eco_claims_unique" ON "product_eco_claims" USING btree ("product_id","eco_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_bucket_path_unq" ON "file_assets" USING btree ("bucket","path");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_job_row_unq" ON "import_rows" USING btree ("job_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_sizes_brand_name_unq" ON "brand_sizes" USING btree ("brand_id","name","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_brand_id_product_identifier_unq" ON "products" USING btree ("brand_id","product_identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_tags_brand_name_unq" ON "brand_tags" USING btree ("brand_id","name");--> statement-breakpoint
CREATE INDEX "tags_on_product_product_id_idx" ON "tags_on_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "tags_on_product_tag_id_idx" ON "tags_on_product" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tags_on_product_tag_product_unq" ON "tags_on_product" USING btree ("tag_id","product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_seasons_brand_name_unq" ON "brand_seasons" USING btree ("brand_id","name");--> statement-breakpoint
ALTER TABLE "brand_facilities" DROP COLUMN "address";--> statement-breakpoint
ALTER TABLE "brand_facilities" DROP COLUMN "contact";--> statement-breakpoint
ALTER TABLE "brand_facilities" DROP COLUMN "vat_number";--> statement-breakpoint
ALTER TABLE "brand_sizes" DROP COLUMN "category_group";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "season";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "brand_certification_id";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "additional_image_urls";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "sku";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "product_image_url";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "ean";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "staging_products" DROP COLUMN "season";--> statement-breakpoint
ALTER TABLE "staging_products" DROP COLUMN "brand_certification_id";--> statement-breakpoint
ALTER TABLE "staging_products" DROP COLUMN "additional_image_urls";--> statement-breakpoint
ALTER TABLE "staging_products" DROP COLUMN "tags";--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "sku";--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "product_image_url";--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "ean";--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "status";--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "brands" ADD CONSTRAINT "brands_avatar_hue_check" CHECK ((avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "brand_invites" ADD CONSTRAINT "brand_invites_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_avatar_hue_check" CHECK ((avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360)));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER POLICY "brands_update_by_owner" ON "brands" RENAME TO "brands_update_by_member";--> statement-breakpoint
ALTER POLICY "brand_certifications_insert_by_brand_owner" ON "brand_certifications" RENAME TO "brand_certifications_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_certifications_update_by_brand_owner" ON "brand_certifications" RENAME TO "brand_certifications_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_certifications_delete_by_brand_owner" ON "brand_certifications" RENAME TO "brand_certifications_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_collections_insert_by_brand_owner" ON "brand_collections" RENAME TO "brand_collections_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_collections_update_by_brand_owner" ON "brand_collections" RENAME TO "brand_collections_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_collections_delete_by_brand_owner" ON "brand_collections" RENAME TO "brand_collections_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_templates_insert_by_brand_owner" ON "passport_templates" RENAME TO "passport_templates_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_templates_update_by_brand_owner" ON "passport_templates" RENAME TO "passport_templates_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_templates_delete_by_brand_owner" ON "passport_templates" RENAME TO "passport_templates_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_template_modules_insert_by_brand_owner" ON "passport_template_modules" RENAME TO "passport_template_modules_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_template_modules_update_by_brand_owner" ON "passport_template_modules" RENAME TO "passport_template_modules_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "passport_template_modules_delete_by_brand_owner" ON "passport_template_modules" RENAME TO "passport_template_modules_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_colors_insert_by_brand_owner" ON "brand_colors" RENAME TO "brand_colors_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_colors_update_by_brand_owner" ON "brand_colors" RENAME TO "brand_colors_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_colors_delete_by_brand_owner" ON "brand_colors" RENAME TO "brand_colors_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_eco_claims_insert_by_brand_owner" ON "brand_eco_claims" RENAME TO "brand_eco_claims_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_eco_claims_update_by_brand_owner" ON "brand_eco_claims" RENAME TO "brand_eco_claims_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_eco_claims_delete_by_brand_owner" ON "brand_eco_claims" RENAME TO "brand_eco_claims_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_facilities_insert_by_brand_owner" ON "brand_facilities" RENAME TO "brand_facilities_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_facilities_update_by_brand_owner" ON "brand_facilities" RENAME TO "brand_facilities_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_facilities_delete_by_brand_owner" ON "brand_facilities" RENAME TO "brand_facilities_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_materials_insert_by_brand_owner" ON "brand_materials" RENAME TO "brand_materials_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_materials_update_by_brand_owner" ON "brand_materials" RENAME TO "brand_materials_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_materials_delete_by_brand_owner" ON "brand_materials" RENAME TO "brand_materials_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_services_insert_by_brand_owner" ON "brand_services" RENAME TO "brand_services_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_services_update_by_brand_owner" ON "brand_services" RENAME TO "brand_services_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_services_delete_by_brand_owner" ON "brand_services" RENAME TO "brand_services_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "showcase_brands_insert_by_brand_owner" ON "showcase_brands" RENAME TO "showcase_brands_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "showcase_brands_update_by_brand_owner" ON "showcase_brands" RENAME TO "showcase_brands_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "showcase_brands_delete_by_brand_owner" ON "showcase_brands" RENAME TO "showcase_brands_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_materials_insert_by_brand_owner" ON "product_materials" RENAME TO "product_materials_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_materials_update_by_brand_owner" ON "product_materials" RENAME TO "product_materials_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_materials_delete_by_brand_owner" ON "product_materials" RENAME TO "product_materials_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_journey_steps_insert_by_brand_owner" ON "product_journey_steps" RENAME TO "product_journey_steps_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_journey_steps_update_by_brand_owner" ON "product_journey_steps" RENAME TO "product_journey_steps_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_journey_steps_delete_by_brand_owner" ON "product_journey_steps" RENAME TO "product_journey_steps_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_environment_insert_by_brand_owner" ON "product_environment" RENAME TO "product_environment_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_environment_update_by_brand_owner" ON "product_environment" RENAME TO "product_environment_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_environment_delete_by_brand_owner" ON "product_environment" RENAME TO "product_environment_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_eco_claims_insert_by_brand_owner" ON "product_eco_claims" RENAME TO "product_eco_claims_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_eco_claims_update_by_brand_owner" ON "product_eco_claims" RENAME TO "product_eco_claims_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_eco_claims_delete_by_brand_owner" ON "product_eco_claims" RENAME TO "product_eco_claims_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "file_assets_insert_by_brand_owner_or_system" ON "file_assets" RENAME TO "file_assets_insert_by_brand_member_or_system";--> statement-breakpoint
ALTER POLICY "file_assets_update_by_brand_owner_or_system" ON "file_assets" RENAME TO "file_assets_update_by_brand_member_or_system";--> statement-breakpoint
ALTER POLICY "file_assets_delete_by_brand_owner_or_system" ON "file_assets" RENAME TO "file_assets_delete_by_brand_member_or_system";--> statement-breakpoint
ALTER POLICY "import_rows_insert_by_brand_owner" ON "import_rows" RENAME TO "import_rows_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "import_rows_update_by_brand_owner" ON "import_rows" RENAME TO "import_rows_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "import_rows_delete_by_brand_owner" ON "import_rows" RENAME TO "import_rows_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "value_mappings_delete_by_brand_owner" ON "value_mappings" RENAME TO "value_mappings_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "value_mappings_insert_by_brand_owner" ON "value_mappings" RENAME TO "value_mappings_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "value_mappings_update_by_brand_owner" ON "value_mappings" RENAME TO "value_mappings_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_sizes_insert_by_brand_owner" ON "brand_sizes" RENAME TO "brand_sizes_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_sizes_update_by_brand_owner" ON "brand_sizes" RENAME TO "brand_sizes_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_sizes_delete_by_brand_owner" ON "brand_sizes" RENAME TO "brand_sizes_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "import_jobs_insert_by_brand_owner" ON "import_jobs" RENAME TO "import_jobs_insert_by_brand_member";--> statement-breakpoint
DO $$ BEGIN
  ALTER POLICY "import_jobs_update_by_brand_owner" ON "import_jobs" RENAME TO "import_jobs_update_by_brand_member";
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
ALTER POLICY "import_jobs_delete_by_brand_owner" ON "import_jobs" RENAME TO "import_jobs_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_variants_insert_by_brand_owner" ON "product_variants" RENAME TO "product_variants_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_variants_update_by_brand_owner" ON "product_variants" RENAME TO "product_variants_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "product_variants_delete_by_brand_owner" ON "product_variants" RENAME TO "product_variants_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "brands_delete_by_owner" ON "brands" TO authenticated,service_role USING (is_brand_owner(id));--> statement-breakpoint
ALTER POLICY "brands_insert_by_authenticated" ON "brands" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brands_select_for_invite_recipients" ON "brands" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brands_select_for_members" ON "brands" TO authenticated,service_role USING (is_brand_member(id));--> statement-breakpoint
ALTER POLICY "brand_members_delete_owner_non_owner" ON "brand_members" TO authenticated,service_role USING ((is_brand_owner(brand_id) AND ((role <> 'owner'::text) OR (user_id = auth.uid()))));--> statement-breakpoint
ALTER POLICY "brand_members_delete_self" ON "brand_members" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brand_members_insert_first_owner_self" ON "brand_members" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brand_members_select_for_members" ON "brand_members" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_members_update_by_owner" ON "brand_members" TO authenticated,service_role USING (is_brand_owner(brand_id));--> statement-breakpoint
ALTER POLICY "brand_invites_delete_by_owner" ON "brand_invites" TO authenticated,service_role USING (is_brand_owner(brand_id));--> statement-breakpoint
ALTER POLICY "brand_invites_delete_by_recipient" ON "brand_invites" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brand_invites_insert_by_owner" ON "brand_invites" TO authenticated,service_role WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
ALTER POLICY "brand_invites_select_for_members" ON "brand_invites" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brand_invites_select_for_recipient" ON "brand_invites" TO authenticated,service_role;--> statement-breakpoint
ALTER POLICY "brand_invites_update_by_owner" ON "brand_invites" TO authenticated,service_role USING (is_brand_owner(brand_id));--> statement-breakpoint
ALTER POLICY "users_insert_own_profile" ON "users" TO authenticated,service_role WITH CHECK (auth.uid() = id);--> statement-breakpoint
ALTER POLICY "users_select_for_brand_members" ON "users" TO authenticated,service_role USING (shares_brand_with(id));--> statement-breakpoint
ALTER POLICY "users_select_own_profile" ON "users" TO authenticated,service_role USING (auth.uid() = id);--> statement-breakpoint
ALTER POLICY "users_update_own_profile" ON "users" TO authenticated,service_role USING (auth.uid() = id) WITH CHECK (
        auth.uid() = id
        AND (
          brand_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM brand_members uob
            WHERE uob.brand_id = brand_id
              AND uob.user_id = auth.uid()
          )
        )
      );--> statement-breakpoint
ALTER POLICY "categories_modify_system_only" ON "categories" TO authenticated,service_role USING (false) WITH CHECK (false);--> statement-breakpoint
ALTER POLICY "categories_select_for_authenticated" ON "categories" TO authenticated,service_role USING (true);--> statement-breakpoint
ALTER POLICY "brand_certifications_select_for_brand_members" ON "brand_certifications" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_collections_select_for_brand_members" ON "brand_collections" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "passport_templates_select_for_brand_members" ON "passport_templates" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "passport_template_modules_select_for_brand_members" ON "passport_template_modules" TO authenticated,service_role USING (is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id)));--> statement-breakpoint
ALTER POLICY "brand_colors_select_for_brand_members" ON "brand_colors" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_select_for_brand_members" ON "brand_eco_claims" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_select_for_brand_members" ON "brand_facilities" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_select_for_brand_members" ON "brand_materials" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_services_select_for_brand_members" ON "brand_services" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "showcase_brands_select_for_brand_members" ON "showcase_brands" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "product_materials_select_for_brand_members" ON "product_materials" TO authenticated,service_role USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_select_for_brand_members" ON "product_journey_steps" TO authenticated,service_role USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_environment_select_for_brand_members" ON "product_environment" TO authenticated,service_role USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_select_for_brand_members" ON "product_eco_claims" TO authenticated,service_role USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "file_assets_select_for_brand_members" ON "file_assets" TO authenticated,service_role USING ((brand_id IS NULL) OR is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "import_rows_select_for_brand_members" ON "import_rows" TO authenticated,service_role USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "value_mappings_select_for_brand_members" ON "value_mappings" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_select_for_brand_members" ON "brand_sizes" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "import_jobs_select_for_brand_members" ON "import_jobs" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_delete_by_brand_members" ON "products" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_insert_by_brand_members" ON "products" TO authenticated,service_role WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_select_for_brand_members" ON "products" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_update_by_brand_members" ON "products" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "product_variants_select_for_brand_members" ON "product_variants" TO authenticated,service_role USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "brand_tags_delete_by_brand_members" ON "brand_tags" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_tags_insert_by_brand_members" ON "brand_tags" TO authenticated,service_role WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_tags_select_for_brand_members" ON "brand_tags" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_tags_update_by_brand_members" ON "brand_tags" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "staging_products_select_for_brand_members" ON "staging_products" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "tags_on_product_delete_by_brand_members" ON "tags_on_product" TO authenticated,service_role USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "tags_on_product_insert_by_brand_members" ON "tags_on_product" TO authenticated,service_role WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "tags_on_product_select_for_brand_members" ON "tags_on_product" TO authenticated,service_role USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "staging_product_variants_select_for_brand_members" ON "staging_product_variants" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "staging_product_environment_select_for_brand_members" ON "staging_product_environment" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "staging_product_journey_steps_select_for_brand_members" ON "staging_product_journey_steps" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "staging_product_eco_claims_select_for_brand_members" ON "staging_product_eco_claims" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "staging_product_materials_select_for_brand_members" ON "staging_product_materials" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "brand_seasons_delete_by_brand_members" ON "brand_seasons" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_seasons_insert_by_brand_members" ON "brand_seasons" TO authenticated,service_role WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_seasons_select_for_brand_members" ON "brand_seasons" TO authenticated,service_role USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_seasons_update_by_brand_members" ON "brand_seasons" TO authenticated,service_role USING (is_brand_member(brand_id));