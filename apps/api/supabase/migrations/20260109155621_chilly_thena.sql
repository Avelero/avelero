CREATE TABLE "staging_variant_attributes" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_variant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_attributes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_tags" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_product_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_tags" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_product_weight" (
	"staging_product_id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"weight" numeric(10, 2),
	"weight_unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_product_weight" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_variant_materials" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_variant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"brand_material_id" uuid NOT NULL,
	"percentage" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_variant_eco_claims" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_variant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"eco_claim_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_variant_environment" (
	"staging_variant_id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"carbon_kg_co2e" numeric(12, 4),
	"water_liters" numeric(12, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_variant_journey_steps" (
	"staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staging_variant_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"sort_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"facility_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "staging_variant_weight" (
	"staging_variant_id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"weight" numeric(10, 2),
	"weight_unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_variant_weight" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ALTER COLUMN "upid" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "mode" text DEFAULT 'CREATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD COLUMN "has_exportable_failures" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "staging_products" ADD COLUMN "row_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "staging_products" ADD COLUMN "errors" jsonb;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "name_override" text;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "description_override" text;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "image_path_override" text;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "row_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "staging_product_variants" ADD COLUMN "errors" jsonb;--> statement-breakpoint
ALTER TABLE "staging_variant_attributes" ADD CONSTRAINT "staging_variant_attributes_attribute_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."brand_attributes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_attributes" ADD CONSTRAINT "staging_variant_attributes_attribute_value_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."brand_attribute_values"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_attributes" ADD CONSTRAINT "staging_variant_attributes_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_attributes" ADD CONSTRAINT "staging_variant_attributes_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_tags" ADD CONSTRAINT "staging_product_tags_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_tags" ADD CONSTRAINT "staging_product_tags_staging_product_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_tags" ADD CONSTRAINT "staging_product_tags_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_weight" ADD CONSTRAINT "staging_product_weight_staging_product_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_product_weight" ADD CONSTRAINT "staging_product_weight_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_materials" ADD CONSTRAINT "staging_variant_materials_brand_material_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_materials" ADD CONSTRAINT "staging_variant_materials_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_materials" ADD CONSTRAINT "staging_variant_materials_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_eco_claims" ADD CONSTRAINT "staging_variant_eco_claims_eco_claim_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_eco_claims" ADD CONSTRAINT "staging_variant_eco_claims_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_eco_claims" ADD CONSTRAINT "staging_variant_eco_claims_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_environment" ADD CONSTRAINT "staging_variant_environment_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_environment" ADD CONSTRAINT "staging_variant_environment_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_journey_steps" ADD CONSTRAINT "staging_variant_journey_steps_facility_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_journey_steps" ADD CONSTRAINT "staging_variant_journey_steps_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_journey_steps" ADD CONSTRAINT "staging_variant_journey_steps_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_weight" ADD CONSTRAINT "staging_variant_weight_staging_variant_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "staging_variant_weight" ADD CONSTRAINT "staging_variant_weight_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "staging_variant_attributes_job_id_idx" ON "staging_variant_attributes" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_attributes_staging_variant_id_idx" ON "staging_variant_attributes" USING btree ("staging_variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "staging_variant_attributes_unique" ON "staging_variant_attributes" USING btree ("staging_variant_id" uuid_ops,"attribute_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_product_tags_job_id_idx" ON "staging_product_tags" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_product_tags_staging_product_id_idx" ON "staging_product_tags" USING btree ("staging_product_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_tags_unique" ON "staging_product_tags" USING btree ("staging_product_id" uuid_ops,"tag_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_materials_job_id_idx" ON "staging_variant_materials" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_materials_staging_variant_id_idx" ON "staging_variant_materials" USING btree ("staging_variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "staging_variant_materials_unique" ON "staging_variant_materials" USING btree ("staging_variant_id" uuid_ops,"brand_material_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_eco_claims_job_id_idx" ON "staging_variant_eco_claims" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_eco_claims_staging_variant_id_idx" ON "staging_variant_eco_claims" USING btree ("staging_variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "staging_variant_eco_claims_unique" ON "staging_variant_eco_claims" USING btree ("staging_variant_id" uuid_ops,"eco_claim_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_journey_steps_job_id_idx" ON "staging_variant_journey_steps" USING btree ("job_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "staging_variant_journey_steps_staging_variant_id_idx" ON "staging_variant_journey_steps" USING btree ("staging_variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "staging_variant_journey_steps_unique" ON "staging_variant_journey_steps" USING btree ("staging_variant_id" uuid_ops,"sort_index" int4_ops);--> statement-breakpoint
CREATE INDEX "staging_product_variants_barcode_idx" ON "staging_product_variants" USING btree ("barcode" text_ops);--> statement-breakpoint
CREATE INDEX "staging_product_variants_sku_idx" ON "staging_product_variants" USING btree ("sku" text_ops);--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "color_id";--> statement-breakpoint
ALTER TABLE "staging_product_variants" DROP COLUMN "size_id";--> statement-breakpoint
CREATE POLICY "staging_variant_attributes_select_for_brand_members" ON "staging_variant_attributes" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_attributes_insert_by_system" ON "staging_variant_attributes" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_attributes_update_by_system" ON "staging_variant_attributes" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_attributes_delete_by_system" ON "staging_variant_attributes" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_tags_select_for_brand_members" ON "staging_product_tags" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_tags_insert_by_system" ON "staging_product_tags" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_tags_update_by_system" ON "staging_product_tags" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_tags_delete_by_system" ON "staging_product_tags" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_weight_select_for_brand_members" ON "staging_product_weight" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_product_weight_insert_by_system" ON "staging_product_weight" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_weight_update_by_system" ON "staging_product_weight" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_product_weight_delete_by_system" ON "staging_product_weight" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_materials_select_for_brand_members" ON "staging_variant_materials" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_materials_insert_by_system" ON "staging_variant_materials" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_materials_update_by_system" ON "staging_variant_materials" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_materials_delete_by_system" ON "staging_variant_materials" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_eco_claims_select_for_brand_members" ON "staging_variant_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_eco_claims_insert_by_system" ON "staging_variant_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_eco_claims_update_by_system" ON "staging_variant_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_eco_claims_delete_by_system" ON "staging_variant_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_environment_select_for_brand_members" ON "staging_variant_environment" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_environment_insert_by_system" ON "staging_variant_environment" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_environment_update_by_system" ON "staging_variant_environment" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_environment_delete_by_system" ON "staging_variant_environment" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_journey_steps_select_for_brand_members" ON "staging_variant_journey_steps" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_journey_steps_insert_by_system" ON "staging_variant_journey_steps" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_journey_steps_update_by_system" ON "staging_variant_journey_steps" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_journey_steps_delete_by_system" ON "staging_variant_journey_steps" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_weight_select_for_brand_members" ON "staging_variant_weight" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "staging_variant_weight_insert_by_system" ON "staging_variant_weight" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_weight_update_by_system" ON "staging_variant_weight" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role";--> statement-breakpoint
CREATE POLICY "staging_variant_weight_delete_by_system" ON "staging_variant_weight" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role";