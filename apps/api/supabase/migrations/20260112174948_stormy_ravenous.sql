DROP POLICY "staging_products_delete_by_system" ON "staging_products" CASCADE;--> statement-breakpoint
DROP POLICY "staging_products_insert_by_system" ON "staging_products" CASCADE;--> statement-breakpoint
DROP POLICY "staging_products_select_for_brand_members" ON "staging_products" CASCADE;--> statement-breakpoint
DROP POLICY "staging_products_update_by_system" ON "staging_products" CASCADE;--> statement-breakpoint
DROP TABLE "staging_products" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variants_delete_by_system" ON "staging_product_variants" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variants_insert_by_system" ON "staging_product_variants" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variants_select_for_brand_members" ON "staging_product_variants" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_variants_update_by_system" ON "staging_product_variants" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_variants" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_materials_delete_by_system" ON "staging_product_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_materials_insert_by_system" ON "staging_product_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_materials_select_for_brand_members" ON "staging_product_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_materials_update_by_system" ON "staging_product_materials" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_journey_steps_delete_by_system" ON "staging_product_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_journey_steps_insert_by_system" ON "staging_product_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_journey_steps_select_for_brand_members" ON "staging_product_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_journey_steps_update_by_system" ON "staging_product_journey_steps" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_environment_delete_by_system" ON "staging_product_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_environment_insert_by_system" ON "staging_product_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_environment_select_for_brand_members" ON "staging_product_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_environment_update_by_system" ON "staging_product_environment" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_eco_claims_delete_by_system" ON "staging_product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_eco_claims_insert_by_system" ON "staging_product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_eco_claims_select_for_brand_members" ON "staging_product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_eco_claims_update_by_system" ON "staging_product_eco_claims" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_attributes_select_for_brand_members" ON "staging_variant_attributes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_attributes_insert_by_system" ON "staging_variant_attributes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_attributes_update_by_system" ON "staging_variant_attributes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_attributes_delete_by_system" ON "staging_variant_attributes" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_attributes" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_tags_select_for_brand_members" ON "staging_product_tags" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_tags_insert_by_system" ON "staging_product_tags" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_tags_update_by_system" ON "staging_product_tags" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_tags_delete_by_system" ON "staging_product_tags" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_tags" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_weight_select_for_brand_members" ON "staging_product_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_weight_insert_by_system" ON "staging_product_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_weight_update_by_system" ON "staging_product_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_product_weight_delete_by_system" ON "staging_product_weight" CASCADE;--> statement-breakpoint
DROP TABLE "staging_product_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_materials_select_for_brand_members" ON "staging_variant_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_materials_insert_by_system" ON "staging_variant_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_materials_update_by_system" ON "staging_variant_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_materials_delete_by_system" ON "staging_variant_materials" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_materials" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_eco_claims_select_for_brand_members" ON "staging_variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_eco_claims_insert_by_system" ON "staging_variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_eco_claims_update_by_system" ON "staging_variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_eco_claims_delete_by_system" ON "staging_variant_eco_claims" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_eco_claims" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_environment_select_for_brand_members" ON "staging_variant_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_environment_insert_by_system" ON "staging_variant_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_environment_update_by_system" ON "staging_variant_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_environment_delete_by_system" ON "staging_variant_environment" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_environment" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_journey_steps_select_for_brand_members" ON "staging_variant_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_journey_steps_insert_by_system" ON "staging_variant_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_journey_steps_update_by_system" ON "staging_variant_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_journey_steps_delete_by_system" ON "staging_variant_journey_steps" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_journey_steps" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_weight_select_for_brand_members" ON "staging_variant_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_weight_insert_by_system" ON "staging_variant_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_weight_update_by_system" ON "staging_variant_weight" CASCADE;--> statement-breakpoint
DROP POLICY "staging_variant_weight_delete_by_system" ON "staging_variant_weight" CASCADE;--> statement-breakpoint
DROP TABLE "staging_variant_weight" CASCADE;