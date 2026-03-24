ALTER TABLE "brand_billing" RENAME COLUMN "custom_monthly_price_cents" TO "custom_price_cents";--> statement-breakpoint
ALTER TABLE "brand_billing" DROP CONSTRAINT "brand_billing_custom_monthly_price_check";--> statement-breakpoint
ALTER TABLE "brand_plan" ADD COLUMN "billing_interval" text;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD COLUMN "has_impact_predictions" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_billing_interval_check" CHECK (billing_interval IS NULL OR billing_interval = ANY (ARRAY['monthly'::text, 'yearly'::text]));--> statement-breakpoint
ALTER TABLE "brand_billing" ADD CONSTRAINT "brand_billing_custom_price_check" CHECK (custom_price_cents IS NULL OR custom_price_cents >= 0);