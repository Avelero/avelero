CREATE INDEX "idx_users_brand_id" ON "users" USING btree ("brand_id" uuid_ops) WHERE (brand_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_email" ON "brand_invites" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_email_expires" ON "brand_invites" USING btree ("email" text_ops,"expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_id" ON "products" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_status" ON "products" USING btree ("brand_id" uuid_ops,"status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_created" ON "products" USING btree ("brand_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_upid" ON "products" USING btree ("brand_id" uuid_ops,"upid" text_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_category" ON "products" USING btree ("brand_id" uuid_ops,"category_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_season" ON "products" USING btree ("brand_id" uuid_ops,"season_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_products_brand_name" ON "products" USING btree ("brand_id" uuid_ops,"name" text_ops);--> statement-breakpoint
CREATE INDEX "idx_product_variants_product_id" ON "product_variants" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_variants_product_created" ON "product_variants" USING btree ("product_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_product_variants_upid" ON "product_variants" USING btree ("upid" text_ops) WHERE (upid IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_product_materials_product_id" ON "product_materials" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_materials_product_created" ON "product_materials" USING btree ("product_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_product_journey_steps_product_id" ON "product_journey_steps" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_journey_steps_product_sort" ON "product_journey_steps" USING btree ("product_id" uuid_ops,"sort_index" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_product_eco_claims_product_id" ON "product_eco_claims" USING btree ("product_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_product_eco_claims_product_created" ON "product_eco_claims" USING btree ("product_id" uuid_ops,"created_at" timestamptz_ops);