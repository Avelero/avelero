ALTER TABLE "brands" ADD COLUMN "slug" text;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_brands_slug" ON "brands" USING btree ("slug") WHERE (slug IS NOT NULL);