ALTER TABLE "brand_plan" ADD COLUMN "variant_global_cap" integer;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_products_brand_published_at" ON "products" USING btree ("brand_id" uuid_ops,"published_at" timestamptz_ops) WHERE "products"."published_at" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_variant_global_cap_check" CHECK (variant_global_cap IS NULL OR variant_global_cap >= 0);