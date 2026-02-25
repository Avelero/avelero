ALTER TABLE "brand_attribute_values" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_attribute_values" ADD COLUMN "sort_order" integer;