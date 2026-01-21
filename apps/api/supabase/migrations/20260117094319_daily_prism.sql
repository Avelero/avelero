ALTER TABLE "brand_eco_claims" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_eco_claims" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "variant_eco_claims" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_eco_claim_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "brand_eco_claims_select_for_brand_members" ON "brand_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "brand_eco_claims_insert_by_brand_member" ON "brand_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "brand_eco_claims_update_by_brand_member" ON "brand_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "brand_eco_claims_delete_by_brand_member" ON "brand_eco_claims" CASCADE;--> statement-breakpoint
DROP TABLE "brand_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "product_eco_claims_select_for_brand_members" ON "product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "product_eco_claims_insert_by_brand_member" ON "product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "product_eco_claims_update_by_brand_member" ON "product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "product_eco_claims_delete_by_brand_member" ON "product_eco_claims" CASCADE;--> statement-breakpoint
DROP TABLE "product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "variant_eco_claims_select_for_brand_members" ON "variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "variant_eco_claims_insert_by_brand_member" ON "variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "variant_eco_claims_update_by_brand_member" ON "variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "variant_eco_claims_delete_by_brand_member" ON "variant_eco_claims" CASCADE;--> statement-breakpoint
DROP TABLE "variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "integration_eco_claim_links_select_for_brand_members" ON "integration_eco_claim_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_eco_claim_links_insert_by_brand_member" ON "integration_eco_claim_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_eco_claim_links_update_by_brand_member" ON "integration_eco_claim_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_eco_claim_links_delete_by_brand_member" ON "integration_eco_claim_links" CASCADE;--> statement-breakpoint
DROP TABLE "integration_eco_claim_links" CASCADE;--> statement-breakpoint
ALTER TABLE "brand_facilities" RENAME TO "brand_operators";--> statement-breakpoint
ALTER TABLE "integration_facility_links" RENAME TO "integration_operator_links";--> statement-breakpoint
ALTER TABLE "product_journey_steps" RENAME COLUMN "facility_id" TO "operator_id";--> statement-breakpoint
ALTER TABLE "variant_journey_steps" RENAME COLUMN "facility_id" TO "operator_id";--> statement-breakpoint
ALTER TABLE "integration_operator_links" RENAME COLUMN "facility_id" TO "operator_id";--> statement-breakpoint
ALTER TABLE "brand_operators" DROP CONSTRAINT "brand_facilities_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "product_journey_steps" DROP CONSTRAINT "product_journey_steps_facility_id_brand_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "variant_journey_steps" DROP CONSTRAINT "variant_journey_steps_facility_id_brand_facilities_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_operator_links" DROP CONSTRAINT "integration_facility_links_brand_integration_id_brand_integrations_id_fk";
--> statement-breakpoint
ALTER TABLE "integration_operator_links" DROP CONSTRAINT "integration_facility_links_facility_id_brand_facilities_id_fk";
--> statement-breakpoint
DROP INDEX "product_journey_steps_product_sort_unq";--> statement-breakpoint
DROP INDEX "variant_journey_steps_variant_sort_unq";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_variant_journey_steps_facility_id";--> statement-breakpoint
DROP INDEX "integration_facility_links_integration_external_unq";--> statement-breakpoint
DROP INDEX "integration_facility_links_integration_facility_unq";--> statement-breakpoint
DROP INDEX "idx_integration_facility_links_facility";--> statement-breakpoint
ALTER TABLE "brand_operators" ADD CONSTRAINT "brand_operators_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_journey_steps" ADD CONSTRAINT "product_journey_steps_operator_id_brand_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."brand_operators"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_journey_steps" ADD CONSTRAINT "variant_journey_steps_operator_id_brand_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."brand_operators"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_operator_links" ADD CONSTRAINT "integration_operator_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_operator_links" ADD CONSTRAINT "integration_operator_links_operator_id_brand_operators_id_fk" FOREIGN KEY ("operator_id") REFERENCES "public"."brand_operators"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "product_journey_steps_product_sort_operator_unq" ON "product_journey_steps" USING btree ("product_id","sort_index","operator_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_journey_steps_variant_sort_operator_unq" ON "variant_journey_steps" USING btree ("variant_id","sort_index","operator_id");--> statement-breakpoint
CREATE INDEX "idx_variant_journey_steps_operator_id" ON "variant_journey_steps" USING btree ("operator_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "integration_operator_links_integration_external_unq" ON "integration_operator_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_operator_links_integration_operator_unq" ON "integration_operator_links" USING btree ("brand_integration_id","operator_id");--> statement-breakpoint
CREATE INDEX "idx_integration_operator_links_operator" ON "integration_operator_links" USING btree ("operator_id");--> statement-breakpoint
ALTER POLICY "brand_facilities_select_for_brand_members" ON "brand_operators" RENAME TO "brand_operators_select_for_brand_members";--> statement-breakpoint
ALTER POLICY "brand_facilities_insert_by_brand_member" ON "brand_operators" RENAME TO "brand_operators_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_facilities_update_by_brand_member" ON "brand_operators" RENAME TO "brand_operators_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "brand_facilities_delete_by_brand_member" ON "brand_operators" RENAME TO "brand_operators_delete_by_brand_member";--> statement-breakpoint
ALTER POLICY "integration_facility_links_select_for_brand_members" ON "integration_operator_links" RENAME TO "integration_operator_links_select_for_brand_members";--> statement-breakpoint
ALTER POLICY "integration_facility_links_insert_by_brand_member" ON "integration_operator_links" RENAME TO "integration_operator_links_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "integration_facility_links_update_by_brand_member" ON "integration_operator_links" RENAME TO "integration_operator_links_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "integration_facility_links_delete_by_brand_member" ON "integration_operator_links" RENAME TO "integration_operator_links_delete_by_brand_member";