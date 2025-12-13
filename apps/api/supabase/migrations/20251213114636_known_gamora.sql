ALTER TABLE "brand_services" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_journey_step_facilities" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "brand_services_select_for_brand_members" ON "brand_services" CASCADE;--> statement-breakpoint
DROP POLICY "brand_services_insert_by_brand_member" ON "brand_services" CASCADE;--> statement-breakpoint
DROP POLICY "brand_services_update_by_brand_member" ON "brand_services" CASCADE;--> statement-breakpoint
DROP POLICY "brand_services_delete_by_brand_member" ON "brand_services" CASCADE;--> statement-breakpoint
DROP TABLE "brand_services" CASCADE;--> statement-breakpoint
DROP POLICY "product_journey_step_facilities_select_for_brand_members" ON "product_journey_step_facilities" CASCADE;--> statement-breakpoint
DROP POLICY "product_journey_step_facilities_insert_by_brand_member" ON "product_journey_step_facilities" CASCADE;--> statement-breakpoint
DROP POLICY "product_journey_step_facilities_update_by_brand_member" ON "product_journey_step_facilities" CASCADE;--> statement-breakpoint
DROP POLICY "product_journey_step_facilities_delete_by_brand_member" ON "product_journey_step_facilities" CASCADE;--> statement-breakpoint
DROP TABLE "product_journey_step_facilities" CASCADE;--> statement-breakpoint
ALTER TABLE "brand_sizes" DROP CONSTRAINT "brand_sizes_category_id_categories_id_fk";
--> statement-breakpoint
DROP INDEX "brand_sizes_brand_name_unq";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gender" text;--> statement-breakpoint
DELETE FROM "product_journey_steps";--> statement-breakpoint
ALTER TABLE "product_journey_steps" ADD COLUMN "facility_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "product_journey_steps" ADD CONSTRAINT "product_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
DELETE FROM "brand_sizes";--> statement-breakpoint
CREATE UNIQUE INDEX "brand_sizes_brand_name_unq" ON "brand_sizes" USING btree ("brand_id","name");--> statement-breakpoint
ALTER TABLE "brand_sizes" DROP COLUMN "category_id";