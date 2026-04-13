CREATE TABLE "product_delete_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"selection_mode" text NOT NULL,
	"include_ids" text[],
	"exclude_ids" text[],
	"filter_state" jsonb,
	"search_query" text,
	"total_products" integer DEFAULT 0,
	"products_processed" integer DEFAULT 0,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "product_delete_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_delete_job_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "product_delete_job_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_product_variants_enforce_upid_global_guard" ON "public"."product_variants";--> statement-breakpoint
DROP TRIGGER IF EXISTS "trg_product_passports_enforce_upid_global_guard" ON "public"."product_passports";--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."enforce_variant_upid_global_guard"();--> statement-breakpoint
DROP FUNCTION IF EXISTS "public"."enforce_passport_upid_global_guard"();--> statement-breakpoint
DELETE FROM "product_passport_versions" AS "ppv"
USING "product_passports" AS "pp"
LEFT JOIN "product_variants" AS "pv" ON "pv"."id" = "pp"."working_variant_id"
WHERE "ppv"."passport_id" = "pp"."id"
  AND ("pp"."working_variant_id" IS NULL OR "pv"."id" IS NULL);--> statement-breakpoint
DELETE FROM "product_passports" AS "pp"
WHERE "pp"."working_variant_id" IS NULL
   OR NOT EXISTS (
     SELECT 1
     FROM "product_variants" AS "pv"
     WHERE "pv"."id" = "pp"."working_variant_id"
   );--> statement-breakpoint
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_upid_unique";--> statement-breakpoint
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "product_passports" DROP CONSTRAINT "product_passports_working_variant_id_product_variants_id_fk";
--> statement-breakpoint
ALTER TABLE "product_passport_versions" DROP CONSTRAINT "product_passport_versions_passport_id_product_passports_id_fk";
--> statement-breakpoint
DROP INDEX "idx_product_passports_brand_id";--> statement-breakpoint
DROP INDEX "idx_product_passports_brand_dirty";--> statement-breakpoint
DROP INDEX "idx_product_passports_status";--> statement-breakpoint
DROP INDEX "idx_product_passports_orphaned_at";--> statement-breakpoint
DROP INDEX "idx_product_passports_working_variant_id";--> statement-breakpoint
ALTER TABLE "product_passports" ALTER COLUMN "working_variant_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_delete_jobs" ADD CONSTRAINT "product_delete_jobs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_delete_jobs" ADD CONSTRAINT "product_delete_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_delete_job_items" ADD CONSTRAINT "product_delete_job_items_job_id_product_delete_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."product_delete_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_product_delete_job_items_job_status" ON "product_delete_job_items" USING btree ("job_id","status");--> statement-breakpoint
ALTER TABLE "product_passports" ADD CONSTRAINT "product_passports_working_variant_id_product_variants_id_fk" FOREIGN KEY ("working_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_passport_versions" ADD CONSTRAINT "product_passport_versions_passport_id_product_passports_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."product_passports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_product_passports_dirty" ON "product_passports" USING btree ("dirty" bool_ops) WHERE dirty = true;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_passports_working_variant_id" ON "product_passports" USING btree ("working_variant_id" uuid_ops) WHERE working_variant_id IS NOT NULL;--> statement-breakpoint
CREATE POLICY "product_delete_jobs_select_for_brand_members" ON "product_delete_jobs" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_delete_jobs_insert_by_brand_member" ON "product_delete_jobs" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_delete_jobs_update_by_brand_member" ON "product_delete_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id)) WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_delete_jobs_delete_by_brand_member" ON "product_delete_jobs" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_delete_job_items_select_for_brand_members" ON "product_delete_job_items" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_delete_job_items_insert_by_brand_member" ON "product_delete_job_items" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_delete_job_items_update_by_brand_member" ON "product_delete_job_items" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_delete_job_items_delete_by_brand_member" ON "product_delete_job_items" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passports_select_for_brand_members" ON "product_passports" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passports_insert_by_brand_members" ON "product_passports" TO authenticated,service_role WITH CHECK (EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passports_update_by_brand_members" ON "product_passports" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )) WITH CHECK (EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passports_delete_by_brand_members" ON "product_passports" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passports_select_public" ON "product_passports" TO anon USING (current_version_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE pv.id = working_variant_id
            AND p.status = 'published'
        ));--> statement-breakpoint
ALTER POLICY "product_passport_versions_select_for_brand_members" ON "product_passport_versions" TO authenticated,service_role USING (EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passport_versions_insert_by_brand_members" ON "product_passport_versions" TO authenticated,service_role WITH CHECK (EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_passport_versions_select_public" ON "product_passport_versions" TO anon USING (EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND pp.current_version_id IS NOT NULL
          AND p.status = 'published'
      ));--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "upid";--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "brand_id";--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "orphaned_at";--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "sku";--> statement-breakpoint
ALTER TABLE "product_passports" DROP COLUMN "barcode";
