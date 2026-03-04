DROP INDEX "idx_unique_upid_per_brand";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_upid_global" ON "product_variants" USING btree ("upid") WHERE upid IS NOT NULL AND upid != '';