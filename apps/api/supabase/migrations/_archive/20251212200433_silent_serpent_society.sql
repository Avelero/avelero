ALTER TABLE "passport_templates" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passport_template_modules" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY "passport_templates_select_for_brand_members" ON "passport_templates" CASCADE;--> statement-breakpoint
DROP POLICY "passport_templates_insert_by_brand_member" ON "passport_templates" CASCADE;--> statement-breakpoint
DROP POLICY "passport_templates_update_by_brand_member" ON "passport_templates" CASCADE;--> statement-breakpoint
DROP POLICY "passport_templates_delete_by_brand_member" ON "passport_templates" CASCADE;--> statement-breakpoint
DROP TABLE "passport_templates" CASCADE;--> statement-breakpoint
DROP POLICY IF EXISTS "passport_template_modules_select_for_brand_members" ON "passport_template_modules" CASCADE;
DROP POLICY IF EXISTS "passport_template_modules_insert_by_brand_member" ON "passport_template_modules" CASCADE;
DROP POLICY IF EXISTS "passport_template_modules_update_by_brand_member" ON "passport_template_modules" CASCADE;
DROP POLICY IF EXISTS "passport_template_modules_delete_by_brand_member" ON "passport_template_modules" CASCADE;
DROP TABLE "passport_template_modules" CASCADE;--> statement-breakpoint
ALTER TABLE "showcase_brands" RENAME TO "brand_manufacturers";--> statement-breakpoint
ALTER TABLE "products" RENAME COLUMN "showcase_brand_id" TO "manufacturer_id";--> statement-breakpoint
ALTER TABLE "staging_products" RENAME COLUMN "showcase_brand_id" TO "manufacturer_id";--> statement-breakpoint
ALTER TABLE "brand_manufacturers" DROP CONSTRAINT "showcase_brands_brand_id_brands_id_fk";
--> statement-breakpoint
ALTER TABLE "products" DROP CONSTRAINT "products_showcase_brand_id_showcase_brands_id_fk";
--> statement-breakpoint
DROP INDEX "showcase_brands_brand_name_unq";--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "ean" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gtin" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "weight_unit" text;--> statement-breakpoint
ALTER TABLE "brand_manufacturers" ADD CONSTRAINT "brand_manufacturers_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_manufacturer_id_brand_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."brand_manufacturers"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_manufacturers_brand_name_unq" ON "brand_manufacturers" USING btree ("brand_id","name");--> statement-breakpoint
ALTER TABLE "products" DROP COLUMN "template_id";--> statement-breakpoint
ALTER POLICY "showcase_brands_select_for_brand_members" ON "brand_manufacturers" RENAME TO "brand_manufacturers_select_for_brand_members";--> statement-breakpoint
ALTER POLICY "showcase_brands_insert_by_brand_member" ON "brand_manufacturers" RENAME TO "brand_manufacturers_insert_by_brand_member";--> statement-breakpoint
ALTER POLICY "showcase_brands_update_by_brand_member" ON "brand_manufacturers" RENAME TO "brand_manufacturers_update_by_brand_member";--> statement-breakpoint
ALTER POLICY "showcase_brands_delete_by_brand_member" ON "brand_manufacturers" RENAME TO "brand_manufacturers_delete_by_brand_member";