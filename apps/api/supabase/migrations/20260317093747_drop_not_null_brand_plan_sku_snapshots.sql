-- Fix brand_plan snapshot columns to match the nullable snapshot schema.
ALTER TABLE "brand_plan"
  ALTER COLUMN "sku_count_at_year_start" DROP NOT NULL,
  ALTER COLUMN "sku_count_at_onboarding_start" DROP NOT NULL;
