ALTER TABLE "brands" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_brands_active" ON "brands" USING btree ("id") WHERE (deleted_at IS NULL);