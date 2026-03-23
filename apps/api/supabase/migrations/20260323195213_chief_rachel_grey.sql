ALTER TABLE "brand_billing" ADD COLUMN "stripe_subscription_schedule_id" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "scheduled_plan_type" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "scheduled_billing_interval" text;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "scheduled_has_impact_predictions" boolean;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD COLUMN "scheduled_plan_change_effective_at" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_stripe_subscription_schedule_id_unq" ON "brand_billing" USING btree ("stripe_subscription_schedule_id") WHERE (stripe_subscription_schedule_id IS NOT NULL);--> statement-breakpoint
ALTER TABLE "brand_billing" ADD CONSTRAINT "brand_billing_scheduled_plan_type_check" CHECK (scheduled_plan_type IS NULL OR scheduled_plan_type = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'enterprise'::text]));--> statement-breakpoint
ALTER TABLE "brand_billing" ADD CONSTRAINT "brand_billing_scheduled_billing_interval_check" CHECK (scheduled_billing_interval IS NULL OR scheduled_billing_interval = ANY (ARRAY['quarterly'::text, 'yearly'::text]));