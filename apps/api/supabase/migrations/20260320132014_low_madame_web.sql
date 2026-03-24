ALTER TABLE "brand_plan" ADD COLUMN "first_paid_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD COLUMN "annual_usage_anchor_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "idx_brand_plan_first_paid_started_at" ON "brand_plan" USING btree ("first_paid_started_at");--> statement-breakpoint
CREATE INDEX "idx_brand_plan_annual_usage_anchor_at" ON "brand_plan" USING btree ("annual_usage_anchor_at");