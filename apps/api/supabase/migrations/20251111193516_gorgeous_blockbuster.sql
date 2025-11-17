CREATE TABLE "staging_product_care_codes" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"care_code_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_care_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_eco_claims" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"eco_claim_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_environment" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"carbon_kg_co2e" numeric(6, 4),
	"water_liters" numeric(6, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_identifiers" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"id_type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_journey_steps" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"sort_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"facility_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_materials" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"brand_material_id" uuid NOT NULL,
	"percentage" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_variant_identifiers" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_variant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"id_type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_variant_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_variants" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"action" text NOT NULL,
	"existing_variant_id" uuid,
	"id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid,
	"size_id" uuid,
	"sku" text,
	"ean" text,
	"upid" text NOT NULL,
	"product_image_url" text,
	"status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_products" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"action" text NOT NULL,
	"existing_product_id" uuid,
	"id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"showcase_brand_id" uuid,
	"primary_image_url" text,
	"additional_image_urls" text,
	"category_id" uuid,
	"season" text,
	"tags" text,
	"brand_certification_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "commit_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "requires_value_approval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staging_product_care_codes" ADD CONSTRAINT "staging_product_care_codes_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_care_codes" ADD CONSTRAINT "staging_product_care_codes_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_care_codes" ADD CONSTRAINT "staging_product_care_codes_care_code_id_care_codes_id_fk" FOREIGN KEY ("care_code_id") REFERENCES "public"."care_codes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_eco_claims" ADD CONSTRAINT "staging_product_eco_claims_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_eco_claims" ADD CONSTRAINT "staging_product_eco_claims_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_eco_claims" ADD CONSTRAINT "staging_product_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_environment" ADD CONSTRAINT "staging_product_environment_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_environment" ADD CONSTRAINT "staging_product_environment_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_identifiers" ADD CONSTRAINT "staging_product_identifiers_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_identifiers" ADD CONSTRAINT "staging_product_identifiers_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_journey_steps" ADD CONSTRAINT "staging_product_journey_steps_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_journey_steps" ADD CONSTRAINT "staging_product_journey_steps_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_journey_steps" ADD CONSTRAINT "staging_product_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_materials" ADD CONSTRAINT "staging_product_materials_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_materials" ADD CONSTRAINT "staging_product_materials_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_materials" ADD CONSTRAINT "staging_product_materials_brand_material_id_brand_materials_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_variant_identifiers" ADD CONSTRAINT "staging_product_variant_identifiers_staging_variant_id_staging_product_variants_staging_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_variant_identifiers" ADD CONSTRAINT "staging_product_variant_identifiers_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD CONSTRAINT "staging_product_variants_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD CONSTRAINT "staging_product_variants_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD CONSTRAINT "staging_product_variants_existing_variant_id_product_variants_id_fk" FOREIGN KEY ("existing_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_products" ADD CONSTRAINT "staging_products_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_products" ADD CONSTRAINT "staging_products_existing_product_id_products_id_fk" FOREIGN KEY ("existing_product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "staging_product_care_codes_job_id_idx" ON "staging_product_care_codes" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_care_codes_staging_product_id_idx" ON "staging_product_care_codes" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_care_codes_unique" ON "staging_product_care_codes" USING btree ("staging_product_id","care_code_id");--> statement-breakpoint
CREATE INDEX "staging_product_eco_claims_job_id_idx" ON "staging_product_eco_claims" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_eco_claims_staging_product_id_idx" ON "staging_product_eco_claims" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_eco_claims_unique" ON "staging_product_eco_claims" USING btree ("staging_product_id","eco_claim_id");--> statement-breakpoint
CREATE INDEX "staging_product_environment_job_id_idx" ON "staging_product_environment" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_environment_staging_product_id_idx" ON "staging_product_environment" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_environment_unique" ON "staging_product_environment" USING btree ("staging_product_id");--> statement-breakpoint
CREATE INDEX "staging_product_identifiers_job_id_idx" ON "staging_product_identifiers" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_identifiers_staging_product_id_idx" ON "staging_product_identifiers" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_identifiers_unique" ON "staging_product_identifiers" USING btree ("staging_product_id","id_type","value");--> statement-breakpoint
CREATE INDEX "staging_product_journey_steps_job_id_idx" ON "staging_product_journey_steps" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_journey_steps_staging_product_id_idx" ON "staging_product_journey_steps" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_journey_steps_unique" ON "staging_product_journey_steps" USING btree ("staging_product_id","sort_index");--> statement-breakpoint
CREATE INDEX "staging_product_materials_job_id_idx" ON "staging_product_materials" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_materials_staging_product_id_idx" ON "staging_product_materials" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_materials_unique" ON "staging_product_materials" USING btree ("staging_product_id","brand_material_id");--> statement-breakpoint
CREATE INDEX "staging_product_variant_identifiers_job_id_idx" ON "staging_product_variant_identifiers" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_variant_identifiers_staging_variant_id_idx" ON "staging_product_variant_identifiers" USING btree ("staging_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_variant_identifiers_unique" ON "staging_product_variant_identifiers" USING btree ("staging_variant_id","id_type","value");--> statement-breakpoint
CREATE INDEX "staging_product_variants_job_id_idx" ON "staging_product_variants" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_variants_staging_product_id_idx" ON "staging_product_variants" USING btree ("staging_product_id");--> statement-breakpoint
CREATE INDEX "staging_product_variants_action_idx" ON "staging_product_variants" USING btree ("action");--> statement-breakpoint
CREATE INDEX "staging_product_variants_existing_variant_id_idx" ON "staging_product_variants" USING btree ("existing_variant_id");--> statement-breakpoint
CREATE INDEX "staging_product_variants_upid_idx" ON "staging_product_variants" USING btree ("upid");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_variants_job_row_unq" ON "staging_product_variants" USING btree ("job_id","row_number");--> statement-breakpoint
CREATE INDEX "staging_products_job_id_idx" ON "staging_products" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_products_brand_id_idx" ON "staging_products" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "staging_products_action_idx" ON "staging_products" USING btree ("action");--> statement-breakpoint
CREATE INDEX "staging_products_existing_product_id_idx" ON "staging_products" USING btree ("existing_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_products_job_row_unq" ON "staging_products" USING btree ("job_id","row_number");--> statement-breakpoint
CREATE POLICY "staging_product_care_codes_select_for_brand_members" ON "staging_product_care_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_care_codes_insert_by_system" ON "staging_product_care_codes" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_care_codes_update_by_system" ON "staging_product_care_codes" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_care_codes_delete_by_system" ON "staging_product_care_codes" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_eco_claims_select_for_brand_members" ON "staging_product_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_eco_claims_insert_by_system" ON "staging_product_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_eco_claims_update_by_system" ON "staging_product_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_eco_claims_delete_by_system" ON "staging_product_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_environment_select_for_brand_members" ON "staging_product_environment" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_environment_insert_by_system" ON "staging_product_environment" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_environment_update_by_system" ON "staging_product_environment" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_environment_delete_by_system" ON "staging_product_environment" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_identifiers_select_for_brand_members" ON "staging_product_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_identifiers_insert_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_identifiers_update_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_identifiers_delete_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_journey_steps_select_for_brand_members" ON "staging_product_journey_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_journey_steps_insert_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_journey_steps_update_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_journey_steps_delete_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_materials_select_for_brand_members" ON "staging_product_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_materials_insert_by_system" ON "staging_product_materials" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_materials_update_by_system" ON "staging_product_materials" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_materials_delete_by_system" ON "staging_product_materials" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variant_identifiers_select_for_brand_members" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variant_identifiers_insert_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variant_identifiers_update_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variant_identifiers_delete_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variants_select_for_brand_members" ON "staging_product_variants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variants_insert_by_system" ON "staging_product_variants" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variants_update_by_system" ON "staging_product_variants" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_variants_delete_by_system" ON "staging_product_variants" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_products_select_for_brand_members" ON "staging_products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_products_insert_by_system" ON "staging_products" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_products_update_by_system" ON "staging_products" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_products_delete_by_system" ON "staging_products" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM import_jobs
        WHERE import_jobs.id = job_id
        AND is_brand_member(import_jobs.brand_id)
      ));