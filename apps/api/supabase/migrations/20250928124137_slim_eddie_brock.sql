CREATE TYPE "public"."user_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "passports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"status" varchar NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passport_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"theme" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passport_templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passport_template_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passport_template_modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "passport_module_completion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"passport_id" uuid NOT NULL,
	"module_key" text NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"last_evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passport_module_completion" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP INDEX "idx_users_avatar_hue";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" "user_role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_template_id_passport_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."passport_templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passport_templates" ADD CONSTRAINT "passport_templates_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passport_template_modules" ADD CONSTRAINT "passport_template_modules_template_id_passport_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."passport_templates"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passport_module_completion" ADD CONSTRAINT "passport_module_completion_passport_id_passports_id_fk" FOREIGN KEY ("passport_id") REFERENCES "public"."passports"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
DROP POLICY "users_insert_by_service" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "select_own_profile" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "update_own_profile" ON "users" CASCADE;--> statement-breakpoint
DROP POLICY "users_select_for_brand_members" ON "users" CASCADE;--> statement-breakpoint
CREATE POLICY "passports_select_for_brand_members" ON "passports" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_insert_by_brand_owner" ON "passports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_update_by_brand_owner" ON "passports" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_delete_by_brand_owner" ON "passports" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passport_templates_select_for_brand_members" ON "passport_templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passport_templates_insert_by_brand_owner" ON "passport_templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passport_templates_update_by_brand_owner" ON "passport_templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passport_templates_delete_by_brand_owner" ON "passport_templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passport_template_modules_select_for_brand_members" ON "passport_template_modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id)));--> statement-breakpoint
CREATE POLICY "passport_template_modules_insert_by_brand_owner" ON "passport_template_modules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id)));--> statement-breakpoint
CREATE POLICY "passport_template_modules_update_by_brand_owner" ON "passport_template_modules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id)));--> statement-breakpoint
CREATE POLICY "passport_template_modules_delete_by_brand_owner" ON "passport_template_modules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id)));--> statement-breakpoint
CREATE POLICY "passport_module_completion_select_for_brand_members" ON "passport_module_completion" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id)));--> statement-breakpoint
CREATE POLICY "passport_module_completion_insert_by_brand_owner" ON "passport_module_completion" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id)));--> statement-breakpoint
CREATE POLICY "passport_module_completion_update_by_brand_owner" ON "passport_module_completion" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id)));--> statement-breakpoint
CREATE POLICY "passport_module_completion_delete_by_brand_owner" ON "passport_module_completion" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member((SELECT brand_id FROM passports WHERE id = passport_id)));--> statement-breakpoint
ALTER POLICY "brand_certifications_insert_by_brand_owner" ON "brand_certifications" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_certifications_update_by_brand_owner" ON "brand_certifications" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_certifications_delete_by_brand_owner" ON "brand_certifications" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_insert_by_brand_owner" ON "brand_colors" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_update_by_brand_owner" ON "brand_colors" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_colors_delete_by_brand_owner" ON "brand_colors" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_insert_by_brand_owner" ON "brand_eco_claims" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_update_by_brand_owner" ON "brand_eco_claims" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_eco_claims_delete_by_brand_owner" ON "brand_eco_claims" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_insert_by_brand_owner" ON "brand_facilities" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_update_by_brand_owner" ON "brand_facilities" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_facilities_delete_by_brand_owner" ON "brand_facilities" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_insert_by_brand_owner" ON "brand_materials" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_update_by_brand_owner" ON "brand_materials" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_materials_delete_by_brand_owner" ON "brand_materials" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_insert_by_brand_owner" ON "brand_sizes" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_update_by_brand_owner" ON "brand_sizes" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "brand_sizes_delete_by_brand_owner" ON "brand_sizes" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_insert_by_brand_owner" ON "products" TO authenticated WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_update_by_brand_owner" ON "products" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "products_delete_by_brand_owner" ON "products" TO authenticated USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "product_variants_insert_by_brand_owner" ON "product_variants" TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_variants_update_by_brand_owner" ON "product_variants" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_variants_delete_by_brand_owner" ON "product_variants" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_materials_insert_by_brand_owner" ON "product_materials" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_materials_update_by_brand_owner" ON "product_materials" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_materials_delete_by_brand_owner" ON "product_materials" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_insert_by_brand_owner" ON "product_journey_steps" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_update_by_brand_owner" ON "product_journey_steps" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_journey_steps_delete_by_brand_owner" ON "product_journey_steps" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_environment_insert_by_brand_owner" ON "product_environment" TO authenticated WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_environment_update_by_brand_owner" ON "product_environment" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_environment_delete_by_brand_owner" ON "product_environment" TO authenticated USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
ALTER POLICY "product_identifiers_insert_by_brand_owner" ON "product_identifiers" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_identifiers_update_by_brand_owner" ON "product_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_identifiers_delete_by_brand_owner" ON "product_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_insert_by_brand_owner" ON "product_variant_identifiers" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_update_by_brand_owner" ON "product_variant_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_variant_identifiers_delete_by_brand_owner" ON "product_variant_identifiers" TO authenticated USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_insert_by_brand_owner" ON "product_eco_claims" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_update_by_brand_owner" ON "product_eco_claims" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_eco_claims_delete_by_brand_owner" ON "product_eco_claims" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_insert_by_brand_owner" ON "product_care_codes" TO authenticated WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_update_by_brand_owner" ON "product_care_codes" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "product_care_codes_delete_by_brand_owner" ON "product_care_codes" TO authenticated USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));