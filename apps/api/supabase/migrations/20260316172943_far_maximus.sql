ALTER TABLE "brand_plan" RENAME COLUMN "skus_created_this_year" TO "sku_count_at_year_start";--> statement-breakpoint
ALTER TABLE "brand_plan" RENAME COLUMN "skus_created_onboarding" TO "sku_count_at_onboarding_start";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT "brand_plan_skus_created_this_year_check";--> statement-breakpoint
ALTER TABLE "brand_plan" DROP CONSTRAINT "brand_plan_skus_created_onboarding_check";--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_sku_count_at_year_start_check" CHECK (sku_count_at_year_start IS NULL OR sku_count_at_year_start >= 0);--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_sku_count_at_onboarding_start_check" CHECK (sku_count_at_onboarding_start IS NULL OR sku_count_at_onboarding_start >= 0);