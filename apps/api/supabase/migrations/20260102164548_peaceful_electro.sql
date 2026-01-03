ALTER TABLE "products" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "source_integration_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_integrations" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_integrations" ADD COLUMN "match_identifier" text DEFAULT 'barcode';--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_source_integration_id_brand_integrations_id_fk" FOREIGN KEY ("source_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_integrations_primary_unq" ON "brand_integrations" USING btree ("brand_id") WHERE "brand_integrations"."is_primary" = TRUE;