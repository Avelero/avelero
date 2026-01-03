CREATE TABLE "promotion_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"new_primary_integration_id" uuid NOT NULL,
	"old_primary_integration_id" uuid,
	"status" text DEFAULT 'preparing' NOT NULL,
	"phase" integer DEFAULT 0 NOT NULL,
	"variants_processed" integer DEFAULT 0 NOT NULL,
	"total_variants" integer DEFAULT 0 NOT NULL,
	"products_created" integer DEFAULT 0 NOT NULL,
	"products_archived" integer DEFAULT 0 NOT NULL,
	"variants_moved" integer DEFAULT 0 NOT NULL,
	"variants_orphaned" integer DEFAULT 0 NOT NULL,
	"attributes_created" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "promotion_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "promotion_operations" ADD CONSTRAINT "promotion_operations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "promotion_operations" ADD CONSTRAINT "promotion_operations_new_primary_integration_id_brand_integrations_id_fk" FOREIGN KEY ("new_primary_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "promotion_operations" ADD CONSTRAINT "promotion_operations_old_primary_integration_id_brand_integrations_id_fk" FOREIGN KEY ("old_primary_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_promotion_operations_brand_id" ON "promotion_operations" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_promotion_operations_status" ON "promotion_operations" USING btree ("status");--> statement-breakpoint
CREATE POLICY "promotion_operations_select_for_brand_members" ON "promotion_operations" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "promotion_operations_insert_by_brand_member" ON "promotion_operations" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "promotion_operations_update_by_brand_member" ON "promotion_operations" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "promotion_operations_delete_by_brand_member" ON "promotion_operations" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));