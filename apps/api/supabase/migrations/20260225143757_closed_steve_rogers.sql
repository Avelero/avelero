CREATE TABLE "platform_admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid,
	"brand_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_control" (
	"brand_id" uuid PRIMARY KEY NOT NULL,
	"qualification_status" text DEFAULT 'pending' NOT NULL,
	"operational_status" text DEFAULT 'active' NOT NULL,
	"billing_status" text DEFAULT 'unconfigured' NOT NULL,
	"billing_mode" text,
	"billing_access_override" text DEFAULT 'none' NOT NULL,
	"plan_type" text,
	"plan_currency" text DEFAULT 'EUR' NOT NULL,
	"custom_monthly_price_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_control_qualification_status_check" CHECK (qualification_status = ANY (ARRAY['pending'::text, 'qualified'::text, 'rejected'::text])),
	CONSTRAINT "brand_control_operational_status_check" CHECK (operational_status = ANY (ARRAY['active'::text, 'suspended'::text])),
	CONSTRAINT "brand_control_billing_status_check" CHECK (billing_status = ANY (ARRAY['unconfigured'::text, 'pending_payment'::text, 'active'::text, 'past_due'::text, 'canceled'::text])),
	CONSTRAINT "brand_control_billing_mode_check" CHECK (billing_mode IS NULL OR billing_mode = ANY (ARRAY['standard_checkout'::text, 'enterprise_invoice'::text])),
	CONSTRAINT "brand_control_billing_access_override_check" CHECK (billing_access_override = ANY (ARRAY['none'::text, 'temporary_allow'::text, 'temporary_block'::text])),
	CONSTRAINT "brand_control_plan_type_check" CHECK (plan_type IS NULL OR plan_type = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'custom'::text])),
	CONSTRAINT "brand_control_plan_currency_check" CHECK (char_length(plan_currency) = 3 AND plan_currency = upper(plan_currency)),
	CONSTRAINT "brand_control_custom_monthly_price_positive_check" CHECK (custom_monthly_price_cents IS NULL OR custom_monthly_price_cents > 0),
	CONSTRAINT "brand_control_custom_price_plan_consistency_check" CHECK ((
        (plan_type = 'custom' AND custom_monthly_price_cents IS NOT NULL)
        OR
        (COALESCE(plan_type, '') <> 'custom' AND custom_monthly_price_cents IS NULL)
      ))
);
--> statement-breakpoint
ALTER TABLE "brand_control" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "platform_admin_audit_logs" ADD CONSTRAINT "platform_admin_audit_logs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_control" ADD CONSTRAINT "brand_control_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
INSERT INTO "brand_control" ("brand_id")
SELECT b."id"
FROM "brands" b
WHERE NOT EXISTS (
  SELECT 1
  FROM "brand_control" bc
  WHERE bc."brand_id" = b."id"
)
ON CONFLICT ("brand_id") DO NOTHING;--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_created_at" ON "platform_admin_audit_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_brand_id" ON "platform_admin_audit_logs" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_actor_user_id" ON "platform_admin_audit_logs" USING btree ("actor_user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_platform_admin_audit_logs_action" ON "platform_admin_audit_logs" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_control_qualification_status" ON "brand_control" USING btree ("qualification_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_control_billing_status" ON "brand_control" USING btree ("billing_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_control_plan_type" ON "brand_control" USING btree ("plan_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_control_admin_filters" ON "brand_control" USING btree ("qualification_status" text_ops,"billing_status" text_ops,"operational_status" text_ops);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_select_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_insert_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_update_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "platform_admin_audit_logs_delete_by_service_role" ON "platform_admin_audit_logs" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_control_select_by_service_role" ON "brand_control" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_control_insert_by_service_role" ON "brand_control" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "brand_control_update_by_service_role" ON "brand_control" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_control_delete_by_service_role" ON "brand_control" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);
