CREATE TABLE "qr_export_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"user_email" text NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"selection_mode" text NOT NULL,
	"include_ids" text[],
	"exclude_ids" text[],
	"filter_state" jsonb,
	"search_query" text,
	"custom_domain" text NOT NULL,
	"total_products" integer DEFAULT 0,
	"total_variants" integer DEFAULT 0,
	"eligible_variants" integer DEFAULT 0,
	"variants_processed" integer DEFAULT 0,
	"file_path" text,
	"download_url" text,
	"expires_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "qr_export_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "qr_export_jobs" ADD CONSTRAINT "qr_export_jobs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "qr_export_jobs" ADD CONSTRAINT "qr_export_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE POLICY "qr_export_jobs_select_for_brand_members" ON "qr_export_jobs" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "qr_export_jobs_insert_by_brand_member" ON "qr_export_jobs" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "qr_export_jobs_update_by_brand_member" ON "qr_export_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "qr_export_jobs_delete_by_brand_member" ON "qr_export_jobs" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));