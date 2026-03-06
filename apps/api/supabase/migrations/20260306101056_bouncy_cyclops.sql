ALTER TABLE "product_passports" ALTER COLUMN "first_published_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "product_passports" ADD COLUMN "dirty" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_product_passports_brand_dirty" ON "product_passports" USING btree ("brand_id" uuid_ops,"dirty" bool_ops) WHERE dirty = true;