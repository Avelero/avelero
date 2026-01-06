CREATE TABLE "integration_variant_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_product_id" text,
	"external_sku" text,
	"external_barcode" text,
	"last_synced_at" timestamp with time zone,
	"last_synced_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_variant_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "gender" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "ean" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "gtin" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "barcode" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "variants_processed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "variants_created" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "variants_updated" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "variants_failed" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD COLUMN "variants_skipped" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_variant_links" ADD CONSTRAINT "integration_variant_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_variant_links" ADD CONSTRAINT "integration_variant_links_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "integration_variant_links_integration_external_unq" ON "integration_variant_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_integration_variant_links_variant" ON "integration_variant_links" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "idx_integration_variant_links_integration" ON "integration_variant_links" USING btree ("brand_integration_id");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "ean";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "gtin";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "gender";--> statement-breakpoint
CREATE POLICY "integration_variant_links_select_for_brand_members" ON "integration_variant_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_variant_links_insert_by_service" ON "integration_variant_links" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "integration_variant_links_update_by_service" ON "integration_variant_links" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "integration_variant_links_delete_by_service" ON "integration_variant_links" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);