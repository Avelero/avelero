ALTER TABLE "products" RENAME COLUMN "product_identifier" TO "product_handle";--> statement-breakpoint
DO $$
BEGIN
  ALTER TABLE "staging_products" RENAME COLUMN "product_identifier" TO "product_handle";
EXCEPTION WHEN undefined_column THEN
  -- Column doesn't exist, add it with the new name
  ALTER TABLE "staging_products" ADD COLUMN "product_handle" text;
END $$;--> statement-breakpoint
DROP INDEX IF EXISTS "products_brand_id_product_identifier_unq";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "products_brand_id_product_handle_unq" ON "products" USING btree ("brand_id","product_handle");