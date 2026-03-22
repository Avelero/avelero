ALTER TABLE "brand_plan" DROP CONSTRAINT "brand_plan_billing_interval_check";--> statement-breakpoint
ALTER TABLE "brand_plan" ADD COLUMN "total_credits" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD COLUMN "onboarding_discount_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_total_credits_check" CHECK (total_credits >= 0);--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_billing_interval_check" CHECK (billing_interval IS NULL OR billing_interval = ANY (ARRAY['monthly'::text, 'quarterly'::text, 'yearly'::text]));