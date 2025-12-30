CREATE TABLE "variant_commercial" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"webshop_url" text,
	"price" numeric(10, 2),
	"currency" text,
	"sales_status" text,
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_commercial" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_environment" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"carbon_kg_co2e" numeric(12, 4),
	"water_liters" numeric(12, 2),
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_eco_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"eco_claim_id" uuid NOT NULL,
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"brand_material_id" uuid NOT NULL,
	"percentage" numeric(6, 2),
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_weight" (
	"variant_id" uuid PRIMARY KEY NOT NULL,
	"weight" numeric(10, 2),
	"weight_unit" text,
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_weight" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "variant_journey_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"sort_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"facility_id" uuid NOT NULL,
	"source_integration" text,
	"source_external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "variant_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "taxonomy_external_mappings" DROP CONSTRAINT "taxonomy_external_mappings_slug_unique";--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "name" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "image_path" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "source_integration" text;--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "source_external_id" text;--> statement-breakpoint
ALTER TABLE "variant_commercial" ADD CONSTRAINT "variant_commercial_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_environment" ADD CONSTRAINT "variant_environment_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_eco_claims" ADD CONSTRAINT "variant_eco_claims_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_eco_claims" ADD CONSTRAINT "variant_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_materials" ADD CONSTRAINT "variant_materials_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_materials" ADD CONSTRAINT "variant_materials_brand_material_id_brand_materials_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_weight" ADD CONSTRAINT "variant_weight_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_journey_steps" ADD CONSTRAINT "variant_journey_steps_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "variant_journey_steps" ADD CONSTRAINT "variant_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "variant_eco_claims_unique" ON "variant_eco_claims" USING btree ("variant_id","eco_claim_id");--> statement-breakpoint
CREATE INDEX "idx_variant_eco_claims_variant_id" ON "variant_eco_claims" USING btree ("variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "variant_materials_variant_material_unq" ON "variant_materials" USING btree ("variant_id","brand_material_id");--> statement-breakpoint
CREATE INDEX "idx_variant_materials_variant_id" ON "variant_materials" USING btree ("variant_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "variant_journey_steps_variant_sort_unq" ON "variant_journey_steps" USING btree ("variant_id","sort_index");--> statement-breakpoint
CREATE INDEX "idx_variant_journey_steps_variant_id" ON "variant_journey_steps" USING btree ("variant_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_variant_journey_steps_variant_sort" ON "variant_journey_steps" USING btree ("variant_id" uuid_ops,"sort_index" int4_ops);--> statement-breakpoint
CREATE POLICY "variant_commercial_select_for_brand_members" ON "variant_commercial" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_commercial_insert_by_brand_member" ON "variant_commercial" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_commercial_update_by_brand_member" ON "variant_commercial" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_commercial_delete_by_brand_member" ON "variant_commercial" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_environment_select_for_brand_members" ON "variant_environment" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_environment_insert_by_brand_member" ON "variant_environment" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_environment_update_by_brand_member" ON "variant_environment" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_environment_delete_by_brand_member" ON "variant_environment" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_eco_claims_select_for_brand_members" ON "variant_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_eco_claims_insert_by_brand_member" ON "variant_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_eco_claims_update_by_brand_member" ON "variant_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_eco_claims_delete_by_brand_member" ON "variant_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_materials_select_for_brand_members" ON "variant_materials" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_materials_insert_by_brand_member" ON "variant_materials" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_materials_update_by_brand_member" ON "variant_materials" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_materials_delete_by_brand_member" ON "variant_materials" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_weight_select_for_brand_members" ON "variant_weight" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_weight_insert_by_brand_member" ON "variant_weight" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_weight_update_by_brand_member" ON "variant_weight" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_weight_delete_by_brand_member" ON "variant_weight" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_journey_steps_select_for_brand_members" ON "variant_journey_steps" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_journey_steps_insert_by_brand_member" ON "variant_journey_steps" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_journey_steps_update_by_brand_member" ON "variant_journey_steps" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "variant_journey_steps_delete_by_brand_member" ON "variant_journey_steps" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      ));--> statement-breakpoint
ALTER POLICY "users_update_own_profile" ON "users" TO authenticated,service_role USING (auth.uid() = id) WITH CHECK (
        auth.uid() = id
        AND (
          brand_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM brand_members bm
            WHERE bm.brand_id = users.brand_id
              AND bm.user_id = auth.uid()
          )
        )
      );