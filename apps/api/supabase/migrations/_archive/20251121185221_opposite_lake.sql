CREATE TABLE "product_journey_step_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journey_step_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_journey_step_facilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_journey_steps" DROP CONSTRAINT "product_journey_steps_facility_id_brand_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "product_journey_step_facilities" ADD CONSTRAINT "product_journey_step_facilities_journey_step_id_product_journey_steps_id_fk" FOREIGN KEY ("journey_step_id") REFERENCES "public"."product_journey_steps"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_journey_step_facilities" ADD CONSTRAINT "product_journey_step_facilities_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "product_journey_step_facilities_unique" ON "product_journey_step_facilities" USING btree ("journey_step_id","facility_id");--> statement-breakpoint
CREATE INDEX "idx_journey_step_facilities_step_id" ON "product_journey_step_facilities" USING btree ("journey_step_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "product_journey_steps" DROP COLUMN "facility_id";--> statement-breakpoint
CREATE POLICY "product_journey_step_facilities_select_for_brand_members" ON "product_journey_step_facilities" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_step_facilities_insert_by_brand_member" ON "product_journey_step_facilities" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_step_facilities_update_by_brand_member" ON "product_journey_step_facilities" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_step_facilities_delete_by_brand_member" ON "product_journey_step_facilities" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_journey_steps pjs
        INNER JOIN products p ON pjs.product_id = p.id
        WHERE pjs.id = journey_step_id
        AND is_brand_member(p.brand_id)
      ));