-- Add missing staging tables for journey steps, environment, and identifiers
-- These tables support the bulk import feature for complete product data

-- Create staging_product_journey_steps table
CREATE TABLE "staging_product_journey_steps" (
  "staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staging_product_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "sort_index" integer NOT NULL,
  "step_type" text NOT NULL,
  "facility_id" uuid NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staging_product_journey_steps_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade,
  CONSTRAINT "staging_product_journey_steps_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade,
  CONSTRAINT "staging_product_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade
);--> statement-breakpoint

-- Create staging_product_environment table
CREATE TABLE "staging_product_environment" (
  "staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staging_product_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "carbon_kg_co2e" numeric(6, 4),
  "water_liters" numeric(6, 4),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staging_product_environment_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade,
  CONSTRAINT "staging_product_environment_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade
);--> statement-breakpoint

-- Create staging_product_identifiers table
CREATE TABLE "staging_product_identifiers" (
  "staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staging_product_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "id_type" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staging_product_identifiers_staging_product_id_staging_products_staging_id_fk" FOREIGN KEY ("staging_product_id") REFERENCES "public"."staging_products"("staging_id") ON DELETE cascade ON UPDATE cascade,
  CONSTRAINT "staging_product_identifiers_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade
);--> statement-breakpoint

-- Create staging_product_variant_identifiers table
CREATE TABLE "staging_product_variant_identifiers" (
  "staging_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "staging_variant_id" uuid NOT NULL,
  "job_id" uuid NOT NULL,
  "id_type" text NOT NULL,
  "value" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "staging_product_variant_identifiers_staging_variant_id_staging_product_variants_staging_id_fk" FOREIGN KEY ("staging_variant_id") REFERENCES "public"."staging_product_variants"("staging_id") ON DELETE cascade ON UPDATE cascade,
  CONSTRAINT "staging_product_variant_identifiers_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade
);--> statement-breakpoint

-- Create indexes for staging_product_journey_steps
CREATE INDEX "staging_product_journey_steps_job_id_idx" ON "staging_product_journey_steps" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_journey_steps_staging_product_id_idx" ON "staging_product_journey_steps" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_journey_steps_unique" ON "staging_product_journey_steps" USING btree ("staging_product_id", "sort_index");--> statement-breakpoint

-- Create indexes for staging_product_environment
CREATE INDEX "staging_product_environment_job_id_idx" ON "staging_product_environment" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_environment_staging_product_id_idx" ON "staging_product_environment" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_environment_unique" ON "staging_product_environment" USING btree ("staging_product_id");--> statement-breakpoint

-- Create indexes for staging_product_identifiers
CREATE INDEX "staging_product_identifiers_job_id_idx" ON "staging_product_identifiers" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_identifiers_staging_product_id_idx" ON "staging_product_identifiers" USING btree ("staging_product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_identifiers_unique" ON "staging_product_identifiers" USING btree ("staging_product_id", "id_type", "value");--> statement-breakpoint

-- Create indexes for staging_product_variant_identifiers
CREATE INDEX "staging_product_variant_identifiers_job_id_idx" ON "staging_product_variant_identifiers" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "staging_product_variant_identifiers_staging_variant_id_idx" ON "staging_product_variant_identifiers" USING btree ("staging_variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "staging_product_variant_identifiers_unique" ON "staging_product_variant_identifiers" USING btree ("staging_variant_id", "id_type", "value");--> statement-breakpoint

-- Enable RLS on all new staging tables
ALTER TABLE "staging_product_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staging_product_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staging_product_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "staging_product_variant_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- RLS Policies for staging_product_journey_steps
CREATE POLICY "staging_product_journey_steps_select_for_brand_members" ON "staging_product_journey_steps" AS PERMISSIVE FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_journey_steps_insert_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR INSERT TO authenticated, service_role WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_journey_steps_update_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR UPDATE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_journey_steps_delete_by_system" ON "staging_product_journey_steps" AS PERMISSIVE FOR DELETE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

-- RLS Policies for staging_product_environment
CREATE POLICY "staging_product_environment_select_for_brand_members" ON "staging_product_environment" AS PERMISSIVE FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_environment_insert_by_system" ON "staging_product_environment" AS PERMISSIVE FOR INSERT TO authenticated, service_role WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_environment_update_by_system" ON "staging_product_environment" AS PERMISSIVE FOR UPDATE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_environment_delete_by_system" ON "staging_product_environment" AS PERMISSIVE FOR DELETE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

-- RLS Policies for staging_product_identifiers
CREATE POLICY "staging_product_identifiers_select_for_brand_members" ON "staging_product_identifiers" AS PERMISSIVE FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_identifiers_insert_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR INSERT TO authenticated, service_role WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_identifiers_update_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR UPDATE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_identifiers_delete_by_system" ON "staging_product_identifiers" AS PERMISSIVE FOR DELETE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

-- RLS Policies for staging_product_variant_identifiers
CREATE POLICY "staging_product_variant_identifiers_select_for_brand_members" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_variant_identifiers_insert_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR INSERT TO authenticated, service_role WITH CHECK (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_variant_identifiers_update_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR UPDATE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);--> statement-breakpoint

CREATE POLICY "staging_product_variant_identifiers_delete_by_system" ON "staging_product_variant_identifiers" AS PERMISSIVE FOR DELETE TO authenticated, service_role USING (
  EXISTS (
    SELECT 1 FROM import_jobs
    WHERE import_jobs.id = job_id
    AND is_brand_member(import_jobs.brand_id)
  )
);
