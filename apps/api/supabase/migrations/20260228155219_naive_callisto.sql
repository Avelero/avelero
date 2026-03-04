CREATE TABLE "platform_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"resource_type" text DEFAULT 'unknown' NOT NULL,
	"resource_id" text DEFAULT 'unknown' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"phase" text DEFAULT 'demo' NOT NULL,
	"phase_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"trial_started_at" timestamp with time zone,
	"trial_ends_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"hard_delete_after" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_lifecycle_phase_check" CHECK (phase = ANY (ARRAY['demo'::text, 'trial'::text, 'expired'::text, 'active'::text, 'past_due'::text, 'suspended'::text, 'cancelled'::text]))
);
--> statement-breakpoint
ALTER TABLE "brand_lifecycle" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"plan_type" text,
	"plan_selected_at" timestamp with time zone,
	"sku_annual_limit" integer,
	"sku_onboarding_limit" integer,
	"sku_limit_override" integer,
	"sku_year_start" date,
	"skus_created_this_year" integer DEFAULT 0 NOT NULL,
	"skus_created_onboarding" integer DEFAULT 0 NOT NULL,
	"max_seats" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_plan_type_check" CHECK (plan_type IS NULL OR plan_type = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'enterprise'::text])),
	CONSTRAINT "brand_plan_sku_annual_limit_check" CHECK (sku_annual_limit IS NULL OR sku_annual_limit >= 0),
	CONSTRAINT "brand_plan_sku_onboarding_limit_check" CHECK (sku_onboarding_limit IS NULL OR sku_onboarding_limit >= 0),
	CONSTRAINT "brand_plan_sku_limit_override_check" CHECK (sku_limit_override IS NULL OR sku_limit_override >= 0),
	CONSTRAINT "brand_plan_skus_created_this_year_check" CHECK (skus_created_this_year >= 0),
	CONSTRAINT "brand_plan_skus_created_onboarding_check" CHECK (skus_created_onboarding >= 0),
	CONSTRAINT "brand_plan_max_seats_check" CHECK (max_seats IS NULL OR max_seats > 0)
);
--> statement-breakpoint
ALTER TABLE "brand_plan" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_billing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"billing_mode" text,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan_currency" text DEFAULT 'EUR' NOT NULL,
	"custom_monthly_price_cents" integer,
	"billing_access_override" text DEFAULT 'none' NOT NULL,
	"billing_override_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_billing_mode_check" CHECK (billing_mode IS NULL OR billing_mode = ANY (ARRAY['stripe_checkout'::text, 'stripe_invoice'::text])),
	CONSTRAINT "brand_billing_plan_currency_check" CHECK (char_length(plan_currency) = 3),
	CONSTRAINT "brand_billing_custom_monthly_price_check" CHECK (custom_monthly_price_cents IS NULL OR custom_monthly_price_cents >= 0),
	CONSTRAINT "brand_billing_access_override_check" CHECK (billing_access_override = ANY (ARRAY['none'::text, 'temporary_allow'::text, 'temporary_block'::text]))
);
--> statement-breakpoint
ALTER TABLE "brand_billing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_billing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"stripe_event_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_billing_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_lifecycle" ADD CONSTRAINT "brand_lifecycle_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_plan" ADD CONSTRAINT "brand_plan_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_billing" ADD CONSTRAINT "brand_billing_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_billing_events" ADD CONSTRAINT "brand_billing_events_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_actor_user_id" ON "platform_admin_audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_resource" ON "platform_admin_audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_created_at" ON "platform_admin_audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_lifecycle_brand_id_unq" ON "brand_lifecycle" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_brand_lifecycle_phase" ON "brand_lifecycle" USING btree ("phase");--> statement-breakpoint
CREATE INDEX "idx_brand_lifecycle_trial_ends_at" ON "brand_lifecycle" USING btree ("trial_ends_at");--> statement-breakpoint
CREATE INDEX "idx_brand_lifecycle_hard_delete_after" ON "brand_lifecycle" USING btree ("hard_delete_after") WHERE (hard_delete_after IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "brand_plan_brand_id_unq" ON "brand_plan" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_brand_plan_plan_type" ON "brand_plan" USING btree ("plan_type");--> statement-breakpoint
CREATE INDEX "idx_brand_plan_sku_year_start" ON "brand_plan" USING btree ("sku_year_start");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_brand_id_unq" ON "brand_billing" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_stripe_customer_id_unq" ON "brand_billing" USING btree ("stripe_customer_id") WHERE (stripe_customer_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_stripe_subscription_id_unq" ON "brand_billing" USING btree ("stripe_subscription_id") WHERE (stripe_subscription_id IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_brand_billing_override_expires" ON "brand_billing" USING btree ("billing_override_expires_at");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_events_brand_created_at" ON "brand_billing_events" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_brand_billing_events_event_type" ON "brand_billing_events" USING btree ("event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_billing_events_stripe_event_id_unq" ON "brand_billing_events" USING btree ("stripe_event_id") WHERE (stripe_event_id IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_unq" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "idx_stripe_webhook_events_processed_at" ON "stripe_webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_select_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_insert_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_update_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_delete_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_lifecycle_select_for_brand_members" ON "brand_lifecycle" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_lifecycle_insert_by_service_role" ON "brand_lifecycle" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_lifecycle_update_by_service_role" ON "brand_lifecycle" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_lifecycle_delete_by_service_role" ON "brand_lifecycle" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_plan_select_for_brand_members" ON "brand_plan" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_plan_insert_by_service_role" ON "brand_plan" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_plan_update_by_service_role" ON "brand_plan" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_plan_delete_by_service_role" ON "brand_plan" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_billing_select_for_brand_members" ON "brand_billing" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_billing_insert_by_service_role" ON "brand_billing" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_update_by_service_role" ON "brand_billing" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_delete_by_service_role" ON "brand_billing" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_billing_events_select_for_brand_members" ON "brand_billing_events" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_billing_events_insert_by_service_role" ON "brand_billing_events" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_events_update_by_service_role" ON "brand_billing_events" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_billing_events_delete_by_service_role" ON "brand_billing_events" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_select_by_service_role" ON "stripe_webhook_events" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_insert_by_service_role" ON "stripe_webhook_events" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_update_by_service_role" ON "stripe_webhook_events" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "stripe_webhook_events_delete_by_service_role" ON "stripe_webhook_events" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);