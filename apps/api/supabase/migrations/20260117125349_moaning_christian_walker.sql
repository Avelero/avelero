ALTER TABLE "product_passports" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "product_passports" ADD COLUMN "orphaned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_passports" ADD COLUMN "sku" text;--> statement-breakpoint
ALTER TABLE "product_passports" ADD COLUMN "barcode" text;--> statement-breakpoint
CREATE INDEX "idx_product_passports_status" ON "product_passports" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_product_passports_orphaned_at" ON "product_passports" USING btree ("orphaned_at" timestamptz_ops) WHERE status = 'orphaned';