CREATE TABLE "brand_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"taxonomy_attribute_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_attributes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_attribute_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"attribute_id" uuid NOT NULL,
	"taxonomy_value_id" uuid,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_attribute_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variant_attributes" (
	"variant_id" uuid NOT NULL,
	"attribute_value_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variant_attributes_pkey" PRIMARY KEY("variant_id","attribute_value_id")
);
--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_weight" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"weight" numeric(10, 2),
	"weight_unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_weight" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_commercial" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"webshop_url" text,
	"price" numeric(10, 2),
	"currency" text,
	"sales_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_commercial" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "taxonomy_attributes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"friendly_id" text NOT NULL,
	"public_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_attributes_friendly_id_unique" UNIQUE("friendly_id"),
	CONSTRAINT "taxonomy_attributes_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "taxonomy_attributes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "taxonomy_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attribute_id" uuid NOT NULL,
	"friendly_id" text NOT NULL,
	"public_id" text NOT NULL,
	"public_attribute_id" text NOT NULL,
	"name" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_values_friendly_id_unique" UNIQUE("friendly_id"),
	CONSTRAINT "taxonomy_values_public_id_unique" UNIQUE("public_id")
);
--> statement-breakpoint
ALTER TABLE "taxonomy_values" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_colors" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_sizes" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_color_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "integration_size_links" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "brand_colors_select_for_brand_members" ON "brand_colors" CASCADE;--> statement-breakpoint
DROP POLICY "brand_colors_insert_by_brand_member" ON "brand_colors" CASCADE;--> statement-breakpoint
DROP POLICY "brand_colors_update_by_brand_member" ON "brand_colors" CASCADE;--> statement-breakpoint
DROP POLICY "brand_colors_delete_by_brand_member" ON "brand_colors" CASCADE;--> statement-breakpoint
DROP TABLE "brand_colors" CASCADE;--> statement-breakpoint
DROP POLICY "brand_sizes_select_for_brand_members" ON "brand_sizes" CASCADE;--> statement-breakpoint
DROP POLICY "brand_sizes_insert_by_brand_member" ON "brand_sizes" CASCADE;--> statement-breakpoint
DROP POLICY "brand_sizes_update_by_brand_member" ON "brand_sizes" CASCADE;--> statement-breakpoint
DROP POLICY "brand_sizes_delete_by_brand_member" ON "brand_sizes" CASCADE;--> statement-breakpoint
DROP TABLE "brand_sizes" CASCADE;--> statement-breakpoint
DROP POLICY "integration_color_links_select_for_brand_members" ON "integration_color_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_color_links_insert_by_brand_member" ON "integration_color_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_color_links_update_by_brand_member" ON "integration_color_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_color_links_delete_by_brand_member" ON "integration_color_links" CASCADE;--> statement-breakpoint
DROP TABLE "integration_color_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_size_links_select_for_brand_members" ON "integration_size_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_size_links_insert_by_brand_member" ON "integration_size_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_size_links_update_by_brand_member" ON "integration_size_links" CASCADE;--> statement-breakpoint
DROP POLICY "integration_size_links_delete_by_brand_member" ON "integration_size_links" CASCADE;--> statement-breakpoint
DROP TABLE "integration_size_links" CASCADE;--> statement-breakpoint
ALTER TABLE "tags_on_product" RENAME TO "product_tags";--> statement-breakpoint
ALTER TABLE "categories" RENAME TO "taxonomy_categories";--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "primary_image_path" TO "image_path";--> statement-breakpoint
ALTER TABLE "staging_products" RENAME COLUMN "primary_image_path" TO "image_path";--> statement-breakpoint
ALTER TABLE "brand_members" DROP CONSTRAINT "brand_members_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "brand_members" DROP CONSTRAINT "brand_members_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "taxonomy_categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_categories_id_fk";
--> statement-breakpoint
ALTER TABLE "product_tags" DROP CONSTRAINT IF EXISTS "tags_on_product_tag_id_brand_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "product_tags" DROP CONSTRAINT IF EXISTS "tags_on_product_product_id_products_id_fk";
--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ADD COLUMN "public_id" text;--> statement-breakpoint
UPDATE "taxonomy_categories" SET "public_id" = gen_random_uuid()::text WHERE "public_id" IS NULL;--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ALTER COLUMN "public_id" SET NOT NULL;
ALTER TABLE "product_environment" ADD COLUMN "value" numeric(12, 4);--> statement-breakpoint
ALTER TABLE "product_environment" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "product_environment" ADD COLUMN "metric" text;--> statement-breakpoint
ALTER TABLE "brand_attributes" ADD CONSTRAINT "brand_attributes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_attributes" ADD CONSTRAINT "brand_attributes_taxonomy_attribute_id_taxonomy_attributes_id_fk" FOREIGN KEY ("taxonomy_attribute_id") REFERENCES "public"."taxonomy_attributes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_attribute_values" ADD CONSTRAINT "brand_attribute_values_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_attribute_values" ADD CONSTRAINT "brand_attribute_values_attribute_id_brand_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."brand_attributes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_attribute_values" ADD CONSTRAINT "brand_attribute_values_taxonomy_value_id_taxonomy_values_id_fk" FOREIGN KEY ("taxonomy_value_id") REFERENCES "public"."taxonomy_values"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_attributes" ADD CONSTRAINT "product_variant_attributes_attribute_value_id_brand_attribute_values_id_fk" FOREIGN KEY ("attribute_value_id") REFERENCES "public"."brand_attribute_values"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_weight" ADD CONSTRAINT "product_weight_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_commercial" ADD CONSTRAINT "product_commercial_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "taxonomy_values" ADD CONSTRAINT "taxonomy_values_attribute_id_taxonomy_attributes_id_fk" FOREIGN KEY ("attribute_id") REFERENCES "public"."taxonomy_attributes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_attributes_brand_name_unq" ON "brand_attributes" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_attribute_values_brand_attr_name_unq" ON "brand_attribute_values" USING btree ("brand_id","attribute_id","name");--> statement-breakpoint
CREATE INDEX "idx_product_variant_attributes_variant" ON "product_variant_attributes" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "taxonomy_attributes_friendly_id_idx" ON "taxonomy_attributes" USING btree ("friendly_id");--> statement-breakpoint
CREATE INDEX "taxonomy_values_attribute_id_idx" ON "taxonomy_values" USING btree ("attribute_id");--> statement-breakpoint
CREATE INDEX "taxonomy_values_friendly_id_idx" ON "taxonomy_values" USING btree ("friendly_id");--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_members" ADD CONSTRAINT "brand_members_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ADD CONSTRAINT "taxonomy_categories_parent_id_taxonomy_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."taxonomy_categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_taxonomy_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."taxonomy_categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_tag_id_brand_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_tags" ADD CONSTRAINT "product_tags_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_products_name" ON "products" USING btree ("name" text_ops);--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "role";--> statement-breakpoint
-- Update handle_new_user function to not use role column (since we just dropped it)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  RETURN new;
END;
$$;--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "weight";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "weight_unit";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "webshop_url";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "price";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "currency";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "sales_status";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "size_order";--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "color_order";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "color_id";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "size_id";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "gender";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "ean";--> statement-breakpoint
ALTER TABLE "product_variants" DROP COLUMN "gtin";--> statement-breakpoint
ALTER TABLE "product_environment" DROP COLUMN "carbon_kg_co2e";--> statement-breakpoint
ALTER TABLE "product_environment" DROP COLUMN "water_liters";--> statement-breakpoint
ALTER TABLE "taxonomy_categories" ADD CONSTRAINT "taxonomy_categories_public_id_unique" UNIQUE("public_id");--> statement-breakpoint
CREATE POLICY "brand_attributes_select_for_brand_members" ON "brand_attributes" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attributes_insert_by_brand_member" ON "brand_attributes" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attributes_update_by_brand_member" ON "brand_attributes" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attributes_delete_by_brand_member" ON "brand_attributes" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attribute_values_select_for_brand_members" ON "brand_attribute_values" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attribute_values_insert_by_brand_member" ON "brand_attribute_values" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attribute_values_update_by_brand_member" ON "brand_attribute_values" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_attribute_values_delete_by_brand_member" ON "brand_attribute_values" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_variant_attributes_select_for_brand_members" ON "product_variant_attributes" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_attributes_insert_by_brand_member" ON "product_variant_attributes" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_attributes_update_by_brand_member" ON "product_variant_attributes" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_attributes_delete_by_brand_member" ON "product_variant_attributes" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_weight_select_for_brand_members" ON "product_weight" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_weight_insert_by_brand_member" ON "product_weight" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_weight_update_by_brand_member" ON "product_weight" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_weight_delete_by_brand_member" ON "product_weight" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_commercial_select_for_brand_members" ON "product_commercial" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_commercial_insert_by_brand_member" ON "product_commercial" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_commercial_update_by_brand_member" ON "product_commercial" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_commercial_delete_by_brand_member" ON "product_commercial" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "taxonomy_attributes_select_for_authenticated" ON "taxonomy_attributes" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "taxonomy_values_select_for_authenticated" ON "taxonomy_values" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (true);