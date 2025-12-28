CREATE TABLE "integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"auth_type" text NOT NULL,
	"icon_path" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_integrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"integration_id" uuid NOT NULL,
	"credentials" text,
	"credentials_iv" text,
	"shop_domain" text,
	"sync_interval" integer DEFAULT 21600 NOT NULL,
	"last_sync_at" timestamp with time zone,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_integrations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_field_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"field_key" text NOT NULL,
	"ownership_enabled" boolean DEFAULT true NOT NULL,
	"source_option_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_field_configs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"trigger_type" text DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"products_processed" integer DEFAULT 0 NOT NULL,
	"products_created" integer DEFAULT 0 NOT NULL,
	"products_updated" integer DEFAULT 0 NOT NULL,
	"products_failed" integer DEFAULT 0 NOT NULL,
	"products_skipped" integer DEFAULT 0 NOT NULL,
	"entities_created" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"error_log" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_product_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_product_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_certification_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"certification_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_certification_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_color_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"color_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_color_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_eco_claim_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"eco_claim_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_eco_claim_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_facility_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"facility_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_facility_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_manufacturer_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"manufacturer_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_manufacturer_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_material_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"material_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_material_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_season_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"season_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_season_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_size_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"size_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_size_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration_tag_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_integration_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"external_id" text NOT NULL,
	"external_name" text,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration_tag_links" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "oauth_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"state" text NOT NULL,
	"brand_id" uuid NOT NULL,
	"integration_slug" text NOT NULL,
	"shop_domain" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "oauth_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_integrations" ADD CONSTRAINT "brand_integrations_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_integrations" ADD CONSTRAINT "brand_integrations_integration_id_integrations_id_fk" FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_field_configs" ADD CONSTRAINT "integration_field_configs_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_sync_jobs" ADD CONSTRAINT "integration_sync_jobs_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_product_links" ADD CONSTRAINT "integration_product_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_product_links" ADD CONSTRAINT "integration_product_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_certification_links" ADD CONSTRAINT "integration_certification_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_certification_links" ADD CONSTRAINT "integration_certification_links_certification_id_brand_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."brand_certifications"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_color_links" ADD CONSTRAINT "integration_color_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_color_links" ADD CONSTRAINT "integration_color_links_color_id_brand_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."brand_colors"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_eco_claim_links" ADD CONSTRAINT "integration_eco_claim_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_eco_claim_links" ADD CONSTRAINT "integration_eco_claim_links_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_facility_links" ADD CONSTRAINT "integration_facility_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_facility_links" ADD CONSTRAINT "integration_facility_links_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_manufacturer_links" ADD CONSTRAINT "integration_manufacturer_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_manufacturer_links" ADD CONSTRAINT "integration_manufacturer_links_manufacturer_id_brand_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."brand_manufacturers"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_material_links" ADD CONSTRAINT "integration_material_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_material_links" ADD CONSTRAINT "integration_material_links_material_id_brand_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."brand_materials"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_season_links" ADD CONSTRAINT "integration_season_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_season_links" ADD CONSTRAINT "integration_season_links_season_id_brand_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."brand_seasons"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_size_links" ADD CONSTRAINT "integration_size_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_size_links" ADD CONSTRAINT "integration_size_links_size_id_brand_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."brand_sizes"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_tag_links" ADD CONSTRAINT "integration_tag_links_brand_integration_id_brand_integrations_id_fk" FOREIGN KEY ("brand_integration_id") REFERENCES "public"."brand_integrations"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "integration_tag_links" ADD CONSTRAINT "integration_tag_links_tag_id_brand_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."brand_tags"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "integrations_slug_unq" ON "integrations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_integrations_brand_integration_unq" ON "brand_integrations" USING btree ("brand_id","integration_id");--> statement-breakpoint
CREATE INDEX "idx_brand_integrations_brand_id" ON "brand_integrations" USING btree ("brand_id");--> statement-breakpoint
CREATE INDEX "idx_brand_integrations_status" ON "brand_integrations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_field_configs_integration_field_unq" ON "integration_field_configs" USING btree ("brand_integration_id","field_key");--> statement-breakpoint
CREATE INDEX "idx_integration_field_configs_integration" ON "integration_field_configs" USING btree ("brand_integration_id");--> statement-breakpoint
CREATE INDEX "idx_integration_sync_jobs_integration" ON "integration_sync_jobs" USING btree ("brand_integration_id");--> statement-breakpoint
CREATE INDEX "idx_integration_sync_jobs_status" ON "integration_sync_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_integration_sync_jobs_created" ON "integration_sync_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_product_links_integration_external_unq" ON "integration_product_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_product_links_integration_product_unq" ON "integration_product_links" USING btree ("brand_integration_id","product_id");--> statement-breakpoint
CREATE INDEX "idx_integration_product_links_product" ON "integration_product_links" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_certification_links_integration_external_unq" ON "integration_certification_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_certification_links_integration_cert_unq" ON "integration_certification_links" USING btree ("brand_integration_id","certification_id");--> statement-breakpoint
CREATE INDEX "idx_integration_certification_links_cert" ON "integration_certification_links" USING btree ("certification_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_color_links_integration_external_unq" ON "integration_color_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_color_links_integration_color_unq" ON "integration_color_links" USING btree ("brand_integration_id","color_id");--> statement-breakpoint
CREATE INDEX "idx_integration_color_links_color" ON "integration_color_links" USING btree ("color_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_eco_claim_links_integration_external_unq" ON "integration_eco_claim_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_eco_claim_links_integration_claim_unq" ON "integration_eco_claim_links" USING btree ("brand_integration_id","eco_claim_id");--> statement-breakpoint
CREATE INDEX "idx_integration_eco_claim_links_claim" ON "integration_eco_claim_links" USING btree ("eco_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_facility_links_integration_external_unq" ON "integration_facility_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_facility_links_integration_facility_unq" ON "integration_facility_links" USING btree ("brand_integration_id","facility_id");--> statement-breakpoint
CREATE INDEX "idx_integration_facility_links_facility" ON "integration_facility_links" USING btree ("facility_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_manufacturer_links_integration_external_unq" ON "integration_manufacturer_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_manufacturer_links_integration_mfr_unq" ON "integration_manufacturer_links" USING btree ("brand_integration_id","manufacturer_id");--> statement-breakpoint
CREATE INDEX "idx_integration_manufacturer_links_mfr" ON "integration_manufacturer_links" USING btree ("manufacturer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_material_links_integration_external_unq" ON "integration_material_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_material_links_integration_material_unq" ON "integration_material_links" USING btree ("brand_integration_id","material_id");--> statement-breakpoint
CREATE INDEX "idx_integration_material_links_material" ON "integration_material_links" USING btree ("material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_season_links_integration_external_unq" ON "integration_season_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_season_links_integration_season_unq" ON "integration_season_links" USING btree ("brand_integration_id","season_id");--> statement-breakpoint
CREATE INDEX "idx_integration_season_links_season" ON "integration_season_links" USING btree ("season_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_size_links_integration_external_unq" ON "integration_size_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_size_links_integration_size_unq" ON "integration_size_links" USING btree ("brand_integration_id","size_id");--> statement-breakpoint
CREATE INDEX "idx_integration_size_links_size" ON "integration_size_links" USING btree ("size_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_tag_links_integration_external_unq" ON "integration_tag_links" USING btree ("brand_integration_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "integration_tag_links_integration_tag_unq" ON "integration_tag_links" USING btree ("brand_integration_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_integration_tag_links_tag" ON "integration_tag_links" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_state" ON "oauth_states" USING btree ("state");--> statement-breakpoint
CREATE INDEX "idx_oauth_states_expires" ON "oauth_states" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "integrations_select_for_authenticated" ON "integrations" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "integrations_insert_by_service_role" ON "integrations" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "integrations_update_by_service_role" ON "integrations" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "integrations_delete_by_service_role" ON "integrations" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "brand_integrations_select_for_brand_members" ON "brand_integrations" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_integrations_insert_by_brand_member" ON "brand_integrations" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_integrations_update_by_brand_member" ON "brand_integrations" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_integrations_delete_by_brand_member" ON "brand_integrations" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "integration_field_configs_select_for_brand_members" ON "integration_field_configs" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_field_configs_insert_by_brand_member" ON "integration_field_configs" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_field_configs_update_by_brand_member" ON "integration_field_configs" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_field_configs_delete_by_brand_member" ON "integration_field_configs" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_sync_jobs_select_for_brand_members" ON "integration_sync_jobs" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_sync_jobs_insert_by_brand_member" ON "integration_sync_jobs" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_sync_jobs_update_by_brand_member" ON "integration_sync_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_sync_jobs_delete_by_brand_member" ON "integration_sync_jobs" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_product_links_select_for_brand_members" ON "integration_product_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_product_links_insert_by_brand_member" ON "integration_product_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_product_links_update_by_brand_member" ON "integration_product_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_product_links_delete_by_brand_member" ON "integration_product_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "integration_certification_links_select_for_brand_members" ON "integration_certification_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_certification_links_insert_by_brand_member" ON "integration_certification_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_certification_links_update_by_brand_member" ON "integration_certification_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_certification_links_delete_by_brand_member" ON "integration_certification_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_color_links_select_for_brand_members" ON "integration_color_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_color_links_insert_by_brand_member" ON "integration_color_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_color_links_update_by_brand_member" ON "integration_color_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_color_links_delete_by_brand_member" ON "integration_color_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_eco_claim_links_select_for_brand_members" ON "integration_eco_claim_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_eco_claim_links_insert_by_brand_member" ON "integration_eco_claim_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_eco_claim_links_update_by_brand_member" ON "integration_eco_claim_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_eco_claim_links_delete_by_brand_member" ON "integration_eco_claim_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_facility_links_select_for_brand_members" ON "integration_facility_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_facility_links_insert_by_brand_member" ON "integration_facility_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_facility_links_update_by_brand_member" ON "integration_facility_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_facility_links_delete_by_brand_member" ON "integration_facility_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_manufacturer_links_select_for_brand_members" ON "integration_manufacturer_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_manufacturer_links_insert_by_brand_member" ON "integration_manufacturer_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_manufacturer_links_update_by_brand_member" ON "integration_manufacturer_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_manufacturer_links_delete_by_brand_member" ON "integration_manufacturer_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_material_links_select_for_brand_members" ON "integration_material_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_material_links_insert_by_brand_member" ON "integration_material_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_material_links_update_by_brand_member" ON "integration_material_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_material_links_delete_by_brand_member" ON "integration_material_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_season_links_select_for_brand_members" ON "integration_season_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_season_links_insert_by_brand_member" ON "integration_season_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_season_links_update_by_brand_member" ON "integration_season_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_season_links_delete_by_brand_member" ON "integration_season_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_size_links_select_for_brand_members" ON "integration_size_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_size_links_insert_by_brand_member" ON "integration_size_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_size_links_update_by_brand_member" ON "integration_size_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_size_links_delete_by_brand_member" ON "integration_size_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_tag_links_select_for_brand_members" ON "integration_tag_links" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_tag_links_insert_by_brand_member" ON "integration_tag_links" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_tag_links_update_by_brand_member" ON "integration_tag_links" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "integration_tag_links_delete_by_brand_member" ON "integration_tag_links" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
      SELECT 1 FROM brand_integrations bi
      WHERE bi.id = brand_integration_id
      AND is_brand_member(bi.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "oauth_states_select_by_service_role" ON "oauth_states" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "oauth_states_insert_by_service_role" ON "oauth_states" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "oauth_states_update_by_service_role" ON "oauth_states" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "oauth_states_delete_by_service_role" ON "oauth_states" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);