CREATE TYPE "public"."data_source_type" AS ENUM('manual', 'import', 'api', 'bulk', 'migration', 'sync', 'webhook');--> statement-breakpoint
CREATE TYPE "public"."entity_status" AS ENUM('draft', 'active', 'inactive', 'published', 'pending', 'archived', 'cancelled', 'deferred', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."environment_type" AS ENUM('development', 'testing', 'staging', 'production');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'timeout', 'retrying');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('read', 'write', 'delete', 'manage', 'admin');--> statement-breakpoint
CREATE TYPE "public"."priority_level" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."sort_direction" AS ENUM('asc', 'desc');--> statement-breakpoint
CREATE TYPE "public"."validation_severity" AS ENUM('info', 'success', 'warning', 'error', 'critical');--> statement-breakpoint
CREATE TYPE "public"."visibility_level" AS ENUM('private', 'internal', 'public', 'restricted');--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'admin' BEFORE 'member';--> statement-breakpoint
ALTER TYPE "public"."user_role" ADD VALUE 'viewer';--> statement-breakpoint
CREATE TABLE "passports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid,
	"variant_id" uuid,
	"template_id" uuid,
	"passport_status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'private' NOT NULL,
	"custom_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"module_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published_at" timestamp with time zone,
	"is_public" boolean DEFAULT false NOT NULL,
	"allow_sharing" boolean DEFAULT false NOT NULL,
	"shareable_until" timestamp with time zone,
	"qr_code_format" text DEFAULT 'png',
	"qr_code_size" text DEFAULT 'medium',
	"include_qr_code" boolean DEFAULT true NOT NULL,
	"validation_score" integer DEFAULT 0,
	"compliance_score" integer DEFAULT 0,
	"data_completeness" integer DEFAULT 0,
	"external_system_id" text,
	"external_id" text,
	"sync_enabled" boolean DEFAULT false NOT NULL,
	"last_sync_at" timestamp with time zone,
	"sync_status" text DEFAULT 'never',
	"primary_language" text DEFAULT 'en' NOT NULL,
	"available_languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"version_notes" text,
	"change_reason" text,
	"last_accessed_at" timestamp with time zone,
	"share_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "passports" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"template_type" text DEFAULT 'passport' NOT NULL,
	"template_status" text DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"module_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"optional_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"allow_customization" boolean DEFAULT true NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"version_notes" text,
	"parent_template_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"validation_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"validation_score" integer DEFAULT 0,
	"primary_language" text DEFAULT 'en' NOT NULL,
	"available_languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "templates" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"module_type" text DEFAULT 'data_collection' NOT NULL,
	"module_status" text DEFAULT 'draft' NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"field_definitions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"validation_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"display_settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"allow_multiple" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"depends_on_modules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"compatible_with" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" text DEFAULT '1.0' NOT NULL,
	"version_notes" text,
	"parent_module_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp with time zone,
	"completion_weight" integer DEFAULT 1 NOT NULL,
	"validation_score" integer DEFAULT 0,
	"compliance_impact" integer DEFAULT 0,
	"primary_language" text DEFAULT 'en' NOT NULL,
	"available_languages" jsonb DEFAULT '["en"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "modules" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "passports" ADD CONSTRAINT "passports_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "templates" ADD CONSTRAINT "templates_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "modules" ADD CONSTRAINT "modules_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "passports_brand_status_idx" ON "passports" USING btree ("brand_id","passport_status");--> statement-breakpoint
CREATE INDEX "passports_brand_visibility_idx" ON "passports" USING btree ("brand_id","visibility");--> statement-breakpoint
CREATE INDEX "passports_brand_created_idx" ON "passports" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "passports_brand_updated_idx" ON "passports" USING btree ("brand_id","updated_at");--> statement-breakpoint
CREATE INDEX "passports_product_idx" ON "passports" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "passports_variant_idx" ON "passports" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "passports_template_idx" ON "passports" USING btree ("template_id");--> statement-breakpoint
CREATE INDEX "passports_published_at_idx" ON "passports" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "passports_public_idx" ON "passports" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "passports_shareable_until_idx" ON "passports" USING btree ("shareable_until");--> statement-breakpoint
CREATE INDEX "passports_external_system_idx" ON "passports" USING btree ("external_system_id");--> statement-breakpoint
CREATE INDEX "passports_external_id_idx" ON "passports" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX "passports_sync_status_idx" ON "passports" USING btree ("sync_status");--> statement-breakpoint
CREATE INDEX "passports_last_sync_at_idx" ON "passports" USING btree ("last_sync_at");--> statement-breakpoint
CREATE INDEX "passports_last_accessed_at_idx" ON "passports" USING btree ("last_accessed_at");--> statement-breakpoint
CREATE INDEX "passports_version_idx" ON "passports" USING btree ("version");--> statement-breakpoint
CREATE INDEX "passports_primary_language_idx" ON "passports" USING btree ("primary_language");--> statement-breakpoint
CREATE INDEX "templates_brand_type_idx" ON "templates" USING btree ("brand_id","template_type");--> statement-breakpoint
CREATE INDEX "templates_brand_status_idx" ON "templates" USING btree ("brand_id","template_status");--> statement-breakpoint
CREATE INDEX "templates_brand_enabled_idx" ON "templates" USING btree ("brand_id","enabled");--> statement-breakpoint
CREATE INDEX "templates_brand_created_idx" ON "templates" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "templates_name_search_idx" ON "templates" USING btree ("name");--> statement-breakpoint
CREATE INDEX "templates_type_idx" ON "templates" USING btree ("template_type");--> statement-breakpoint
CREATE INDEX "templates_status_idx" ON "templates" USING btree ("template_status");--> statement-breakpoint
CREATE INDEX "templates_enabled_idx" ON "templates" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "templates_is_default_idx" ON "templates" USING btree ("is_default");--> statement-breakpoint
CREATE INDEX "templates_parent_template_idx" ON "templates" USING btree ("parent_template_id");--> statement-breakpoint
CREATE INDEX "templates_version_idx" ON "templates" USING btree ("version");--> statement-breakpoint
CREATE INDEX "templates_usage_count_idx" ON "templates" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "templates_last_used_at_idx" ON "templates" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "templates_validation_score_idx" ON "templates" USING btree ("validation_score");--> statement-breakpoint
CREATE INDEX "templates_primary_language_idx" ON "templates" USING btree ("primary_language");--> statement-breakpoint
CREATE INDEX "templates_updated_at_idx" ON "templates" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "modules_brand_type_idx" ON "modules" USING btree ("brand_id","module_type");--> statement-breakpoint
CREATE INDEX "modules_brand_status_idx" ON "modules" USING btree ("brand_id","module_status");--> statement-breakpoint
CREATE INDEX "modules_brand_enabled_idx" ON "modules" USING btree ("brand_id","enabled");--> statement-breakpoint
CREATE INDEX "modules_brand_created_idx" ON "modules" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "modules_name_search_idx" ON "modules" USING btree ("name");--> statement-breakpoint
CREATE INDEX "modules_type_idx" ON "modules" USING btree ("module_type");--> statement-breakpoint
CREATE INDEX "modules_status_idx" ON "modules" USING btree ("module_status");--> statement-breakpoint
CREATE INDEX "modules_enabled_idx" ON "modules" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "modules_required_idx" ON "modules" USING btree ("required");--> statement-breakpoint
CREATE INDEX "modules_system_idx" ON "modules" USING btree ("is_system");--> statement-breakpoint
CREATE INDEX "modules_parent_module_idx" ON "modules" USING btree ("parent_module_id");--> statement-breakpoint
CREATE INDEX "modules_usage_count_idx" ON "modules" USING btree ("usage_count");--> statement-breakpoint
CREATE INDEX "modules_last_used_at_idx" ON "modules" USING btree ("last_used_at");--> statement-breakpoint
CREATE INDEX "modules_validation_score_idx" ON "modules" USING btree ("validation_score");--> statement-breakpoint
CREATE INDEX "modules_compliance_impact_idx" ON "modules" USING btree ("compliance_impact");--> statement-breakpoint
CREATE INDEX "modules_completion_weight_idx" ON "modules" USING btree ("completion_weight");--> statement-breakpoint
CREATE INDEX "modules_version_idx" ON "modules" USING btree ("version");--> statement-breakpoint
CREATE INDEX "modules_primary_language_idx" ON "modules" USING btree ("primary_language");--> statement-breakpoint
CREATE INDEX "modules_updated_at_idx" ON "modules" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "products_brand_created_idx" ON "products" USING btree ("brand_id","created_at");--> statement-breakpoint
CREATE INDEX "products_brand_name_idx" ON "products" USING btree ("brand_id","name");--> statement-breakpoint
CREATE INDEX "products_name_search_idx" ON "products" USING btree ("name");--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "products_showcase_brand_idx" ON "products" USING btree ("showcase_brand_id");--> statement-breakpoint
CREATE INDEX "products_season_idx" ON "products" USING btree ("season");--> statement-breakpoint
CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "product_variants_product_id_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_variants_product_created_idx" ON "product_variants" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "product_variants_product_updated_idx" ON "product_variants" USING btree ("product_id","updated_at");--> statement-breakpoint
CREATE INDEX "product_variants_color_id_idx" ON "product_variants" USING btree ("color_id");--> statement-breakpoint
CREATE INDEX "product_variants_size_id_idx" ON "product_variants" USING btree ("size_id");--> statement-breakpoint
CREATE INDEX "product_variants_color_size_idx" ON "product_variants" USING btree ("color_id","size_id");--> statement-breakpoint
CREATE INDEX "product_variants_sku_idx" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_upid_idx" ON "product_variants" USING btree ("upid");--> statement-breakpoint
CREATE INDEX "product_variants_image_url_idx" ON "product_variants" USING btree ("product_image_url");--> statement-breakpoint
CREATE INDEX "product_variants_created_at_idx" ON "product_variants" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "product_variants_updated_at_idx" ON "product_variants" USING btree ("updated_at");--> statement-breakpoint
CREATE POLICY "passports_select_for_brand_members" ON "passports" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_insert_by_brand_owner" ON "passports" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_update_by_brand_owner" ON "passports" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "passports_delete_by_brand_owner" ON "passports" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "templates_select_for_brand_members" ON "templates" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "templates_insert_by_brand_owner" ON "templates" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "templates_update_by_brand_owner" ON "templates" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "templates_delete_by_brand_owner" ON "templates" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "modules_select_for_brand_members" ON "modules" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "modules_insert_by_brand_owner" ON "modules" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "modules_update_by_brand_owner" ON "modules" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "modules_delete_by_brand_owner" ON "modules" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
ALTER POLICY "product_variants_select_for_brand_members" ON "product_variants" TO authenticated USING (EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
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
    ));