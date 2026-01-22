CREATE TABLE "brand_custom_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"verification_token" text NOT NULL,
	"last_verification_attempt" timestamp with time zone,
	"verification_error" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_custom_domains" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_custom_domains" ADD CONSTRAINT "brand_custom_domains_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_custom_domains_brand_id_unq" ON "brand_custom_domains" USING btree ("brand_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_custom_domains_domain_unq" ON "brand_custom_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_brand_custom_domains_domain" ON "brand_custom_domains" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "idx_brand_custom_domains_status" ON "brand_custom_domains" USING btree ("status");--> statement-breakpoint
CREATE POLICY "brand_custom_domains_select_for_brand_members" ON "brand_custom_domains" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_custom_domains_insert_by_brand_owner" ON "brand_custom_domains" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_custom_domains_update_by_brand_owner" ON "brand_custom_domains" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_owner(brand_id)) WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_custom_domains_delete_by_brand_owner" ON "brand_custom_domains" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_owner(brand_id));