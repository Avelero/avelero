ALTER TABLE "products" RENAME COLUMN "product_identifier" TO "product_handle";--> statement-breakpoint
ALTER TABLE "staging_products" RENAME COLUMN "product_identifier" TO "product_handle";--> statement-breakpoint
DROP INDEX "products_brand_id_product_identifier_unq";--> statement-breakpoint
CREATE UNIQUE INDEX "products_brand_id_product_handle_unq" ON "products" USING btree ("brand_id","product_handle");