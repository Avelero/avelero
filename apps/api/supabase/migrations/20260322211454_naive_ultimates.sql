ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_sku_annual_limit_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_sku_onboarding_limit_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_sku_limit_override_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_sku_count_at_year_start_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_sku_count_at_onboarding_start_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT IF EXISTS "brand_plan_billing_interval_check";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_brand_plan_first_paid_started_at";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_brand_plan_annual_usage_anchor_at";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_brand_plan_sku_year_start";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_annual_limit";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_onboarding_limit";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_limit_override";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "first_paid_started_at";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "annual_usage_anchor_at";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_year_start";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_count_at_year_start";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP COLUMN IF EXISTS "sku_count_at_onboarding_start";--> statement-breakpoint
UPDATE "brand_plan" SET "billing_interval" = 'quarterly' WHERE "billing_interval" = 'monthly';--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_billing_interval_check" CHECK (billing_interval IS NULL OR billing_interval = ANY (ARRAY['quarterly'::text, 'yearly'::text]));
