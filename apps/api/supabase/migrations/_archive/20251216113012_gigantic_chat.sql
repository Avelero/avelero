DROP INDEX "idx_products_brand_upid";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "size_order" uuid[] DEFAULT '{}'::uuid[];--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "color_order" uuid[] DEFAULT '{}'::uuid[];--> statement-breakpoint
CREATE INDEX "idx_products_brand_product_handle" ON "products" USING btree ("brand_id" uuid_ops,"product_handle" text_ops);--> statement-breakpoint
ALTER TABLE "brand_sizes" DROP COLUMN "sort_index";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "upid";