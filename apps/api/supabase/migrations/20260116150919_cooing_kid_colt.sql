CREATE TABLE "product_passports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upid" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"working_variant_id" uuid,
	"current_version_id" uuid,
	"first_published_at" timestamp with time zone NOT NULL,
	"last_published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_passports_upid_unique" UNIQUE("upid")
);
--> statement-breakpoint
ALTER TABLE "product_passports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_passport_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"data_snapshot" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"schema_version" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_passport_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "has_unpublished_changes" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product_passports" ADD CONSTRAINT "product_passports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_passports" ADD CONSTRAINT "product_passports_working_variant_id_product_variants_id_fk" FOREIGN KEY ("working_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_passport_versions" ADD CONSTRAINT "product_passport_versions_passport_id_product_passports_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."product_passports"("id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_passports_upid" ON "product_passports" USING btree ("upid");--> statement-breakpoint
CREATE INDEX "idx_product_passports_brand_id" ON "product_passports" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_passports_working_variant_id" ON "product_passports" USING btree ("working_variant_id" uuid_ops) WHERE working_variant_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_product_passport_versions_passport_version" ON "product_passport_versions" USING btree ("passport_id","version_number");--> statement-breakpoint
CREATE INDEX "idx_product_passport_versions_passport_id" ON "product_passport_versions" USING btree ("passport_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_passport_versions_passport_published" ON "product_passport_versions" USING btree ("passport_id" uuid_ops,"published_at" timestamptz_ops);--> statement-breakpoint
CREATE POLICY "product_passports_select_for_brand_members" ON "product_passports" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_passports_insert_by_brand_members" ON "product_passports" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_passports_update_by_brand_members" ON "product_passports" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_passports_delete_by_brand_members" ON "product_passports" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_passports_select_public" ON "product_passports" AS PERMISSIVE FOR SELECT TO "anon" USING (current_version_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "product_passport_versions_select_for_brand_members" ON "product_passport_versions" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND is_brand_member(product_passports.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_passport_versions_insert_by_brand_members" ON "product_passport_versions" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND is_brand_member(product_passports.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_passport_versions_select_public" ON "product_passport_versions" AS PERMISSIVE FOR SELECT TO "anon" USING (EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND product_passports.current_version_id IS NOT NULL
      ));