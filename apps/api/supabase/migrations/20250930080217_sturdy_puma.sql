CREATE UNIQUE INDEX "passport_template_modules_template_module_unq" ON "passport_template_modules" USING btree ("template_id","module_key");--> statement-breakpoint
ALTER POLICY "products_insert_by_brand_owner" ON "products" RENAME TO "products_insert_by_brand_members";--> statement-breakpoint
ALTER POLICY "products_update_by_brand_owner" ON "products" RENAME TO "products_update_by_brand_members";--> statement-breakpoint
ALTER POLICY "products_delete_by_brand_owner" ON "products" RENAME TO "products_delete_by_brand_members";