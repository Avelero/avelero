CREATE TYPE "public"."user_role" AS ENUM('owner', 'member');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"full_name" text,
	"avatar_path" text,
	"avatar_hue" smallint,
	"role" "user_role" DEFAULT 'member' NOT NULL,
	"brand_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email"),
	CONSTRAINT "users_avatar_hue_check" CHECK ((avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360)))
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"country_code" text,
	"logo_path" text,
	"avatar_hue" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_avatar_hue_check" CHECK ((avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360)))
);
--> statement-breakpoint
ALTER TABLE "brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users_on_brand" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_on_brand_user_id_brand_id_key" UNIQUE("user_id","brand_id"),
	CONSTRAINT "users_on_brand_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]))
);
--> statement-breakpoint
ALTER TABLE "users_on_brand" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"token_hash" text,
	"created_by" uuid,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_invites_role_check" CHECK (role = ANY (ARRAY['owner'::text, 'member'::text]))
);
--> statement-breakpoint
ALTER TABLE "brand_invites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"title" text NOT NULL,
	"certification_code" text,
	"institute_name" text,
	"institute_address" text,
	"institute_contact" text,
	"issue_date" timestamp,
	"expiry_date" timestamp,
	"file_asset_id" uuid,
	"external_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_certifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_collections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_colors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_colors" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_eco_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"claim" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_facilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"legal_name" text,
	"address" text,
	"city" text,
	"country_code" text,
	"contact" text,
	"vat_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_facilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"certification_id" uuid,
	"recyclable" boolean,
	"country_of_origin" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_services" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"service_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_services" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "brand_sizes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort_index" integer,
	"category_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_sizes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "care_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "showcase_brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"legal_name" text,
	"email" text,
	"phone" text,
	"website" text,
	"address_line_1" text,
	"address_line_2" text,
	"city" text,
	"state" text,
	"zip" text,
	"country_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "showcase_brands" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"showcase_brand_id" uuid,
	"primary_image_url" text,
	"category_id" uuid,
	"season" text,
	"brand_certification_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"color_id" uuid,
	"size_id" uuid,
	"sku" text,
	"upid" text NOT NULL,
	"product_image_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variants" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"brand_material_id" uuid NOT NULL,
	"percentage" numeric(6, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_materials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_journey_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_index" integer NOT NULL,
	"step_type" text NOT NULL,
	"facility_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_journey_steps" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_environment" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"carbon_kg_co2e" numeric(6, 4),
	"water_liters" numeric(6, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_environment" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"id_type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_variant_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"id_type" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_variant_identifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_eco_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"eco_claim_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_eco_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_care_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"care_code_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_care_codes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "file_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"bucket" text NOT NULL,
	"path" text NOT NULL,
	"mime_type" text,
	"bytes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"summary" jsonb
);
--> statement-breakpoint
ALTER TABLE "import_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw" jsonb NOT NULL,
	"normalized" jsonb,
	"error" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_rows" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "value_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"source_column" text NOT NULL,
	"raw_value" text NOT NULL,
	"target" text NOT NULL,
	"target_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "value_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_on_brand" ADD CONSTRAINT "users_on_brand_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users_on_brand" ADD CONSTRAINT "users_on_brand_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_invites" ADD CONSTRAINT "brand_invites_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD CONSTRAINT "brand_certifications_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_certifications" ADD CONSTRAINT "brand_certifications_file_asset_id_file_assets_id_fk" FOREIGN KEY ("file_asset_id") REFERENCES "public"."file_assets"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_collections" ADD CONSTRAINT "brand_collections_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_colors" ADD CONSTRAINT "brand_colors_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_eco_claims" ADD CONSTRAINT "brand_eco_claims_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_facilities" ADD CONSTRAINT "brand_facilities_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_materials" ADD CONSTRAINT "brand_materials_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_materials" ADD CONSTRAINT "brand_materials_certification_id_brand_certifications_id_fk" FOREIGN KEY ("certification_id") REFERENCES "public"."brand_certifications"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_services" ADD CONSTRAINT "brand_services_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_sizes" ADD CONSTRAINT "brand_sizes_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "brand_sizes" ADD CONSTRAINT "brand_sizes_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "showcase_brands" ADD CONSTRAINT "showcase_brands_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_showcase_brand_id_showcase_brands_id_fk" FOREIGN KEY ("showcase_brand_id") REFERENCES "public"."showcase_brands"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_certification_id_brand_certifications_id_fk" FOREIGN KEY ("brand_certification_id") REFERENCES "public"."brand_certifications"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_color_id_brand_colors_id_fk" FOREIGN KEY ("color_id") REFERENCES "public"."brand_colors"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_size_id_brand_sizes_id_fk" FOREIGN KEY ("size_id") REFERENCES "public"."brand_sizes"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_materials" ADD CONSTRAINT "product_materials_brand_material_id_brand_materials_id_fk" FOREIGN KEY ("brand_material_id") REFERENCES "public"."brand_materials"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_journey_steps" ADD CONSTRAINT "product_journey_steps_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_journey_steps" ADD CONSTRAINT "product_journey_steps_facility_id_brand_facilities_id_fk" FOREIGN KEY ("facility_id") REFERENCES "public"."brand_facilities"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_environment" ADD CONSTRAINT "product_environment_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_identifiers" ADD CONSTRAINT "product_identifiers_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_variant_identifiers" ADD CONSTRAINT "product_variant_identifiers_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_eco_claims" ADD CONSTRAINT "product_eco_claims_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_eco_claims" ADD CONSTRAINT "product_eco_claims_eco_claim_id_brand_eco_claims_id_fk" FOREIGN KEY ("eco_claim_id") REFERENCES "public"."brand_eco_claims"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_care_codes" ADD CONSTRAINT "product_care_codes_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "product_care_codes" ADD CONSTRAINT "product_care_codes_care_code_id_care_codes_id_fk" FOREIGN KEY ("care_code_id") REFERENCES "public"."care_codes"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "file_assets" ADD CONSTRAINT "file_assets_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_rows" ADD CONSTRAINT "import_rows_job_id_import_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."import_jobs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "value_mappings" ADD CONSTRAINT "value_mappings_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_brands_email" ON "brands" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brands_avatar_hue" ON "brands" USING btree ("avatar_hue" int2_ops) WHERE (avatar_hue IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_users_on_brand_user_brand" ON "users_on_brand" USING btree ("user_id" uuid_ops,"brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_users_on_brand_brand_id" ON "users_on_brand" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_users_on_brand_user_id" ON "users_on_brand" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_brand_id" ON "brand_invites" USING btree ("brand_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_expires_at" ON "brand_invites" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_token_hash" ON "brand_invites" USING btree ("token_hash" text_ops);--> statement-breakpoint
CREATE INDEX "idx_brand_invites_valid_lookup" ON "brand_invites" USING btree ("brand_id" uuid_ops,"expires_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "ux_brand_invites_token_hash_not_null" ON "brand_invites" USING btree ("token_hash" text_ops) WHERE (token_hash IS NOT NULL);--> statement-breakpoint
CREATE UNIQUE INDEX "categories_parent_name_unq" ON "categories" USING btree ("parent_id","name");--> statement-breakpoint
CREATE INDEX "categories_parent_id_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_collections_brand_name_unq" ON "brand_collections" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_colors_brand_name_unq" ON "brand_colors" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_eco_claims_brand_claim_unq" ON "brand_eco_claims" USING btree ("brand_id","claim");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_services_brand_name_unq" ON "brand_services" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "brand_sizes_brand_name_unq" ON "brand_sizes" USING btree ("brand_id","name","category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_codes_code_unq" ON "care_codes" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "showcase_brands_brand_name_unq" ON "showcase_brands" USING btree ("brand_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "product_materials_product_material_unq" ON "product_materials" USING btree ("product_id","brand_material_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_journey_steps_product_sort_unq" ON "product_journey_steps" USING btree ("product_id","sort_index");--> statement-breakpoint
CREATE UNIQUE INDEX "product_identifiers_product_type_value_unq" ON "product_identifiers" USING btree ("product_id","id_type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_identifiers_product_type_value_unq" ON "product_variant_identifiers" USING btree ("variant_id","id_type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "product_eco_claims_unique" ON "product_eco_claims" USING btree ("product_id","eco_claim_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_care_codes_unique" ON "product_care_codes" USING btree ("product_id","care_code_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_assets_bucket_path_unq" ON "file_assets" USING btree ("bucket","path");--> statement-breakpoint
CREATE UNIQUE INDEX "import_rows_job_row_unq" ON "import_rows" USING btree ("job_id","row_number");--> statement-breakpoint
CREATE UNIQUE INDEX "value_mappings_brand_col_raw_unq" ON "value_mappings" USING btree ("brand_id","source_column","raw_value");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_name" ON "products" USING btree ("brand_id", "name");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_category_id" ON "products" USING btree ("brand_id", "category_id");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_created_at" ON "products" USING btree ("brand_id", "created_at");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_updated_at" ON "products" USING btree ("brand_id", "updated_at");--> statement-breakpoint
CREATE INDEX "idx_products_created_at_id" ON "products" USING btree ("created_at", "id");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_season_created_at" ON "products" USING btree ("brand_id", "season", "created_at");--> statement-breakpoint
CREATE INDEX "idx_products_brand_id_showcase_brand_id_created_at" ON "products" USING btree ("brand_id", "showcase_brand_id", "created_at");--> statement-breakpoint

ALTER TABLE "products" ADD COLUMN "search_vector" tsvector;--> statement-breakpoint

CREATE FUNCTION "public"."set_product_search_vector"() RETURNS trigger AS $$
begin
  new.search_vector := to_tsvector('english', new.name || ' ' || new.description);
  return new;
end;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE TRIGGER "trg_products_search_vector_update"
BEFORE INSERT OR UPDATE ON "products"
FOR EACH ROW EXECUTE FUNCTION "public"."set_product_search_vector"();--> statement-breakpoint

CREATE INDEX "idx_products_search" ON "products" USING GIN ("search_vector");--> statement-breakpoint
CREATE POLICY "brands_update_by_owner" ON "brands" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(id));--> statement-breakpoint
CREATE POLICY "brands_delete_by_owner" ON "brands" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "brands_select_for_invite_recipients" ON "brands" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "brands_select_for_members" ON "brands" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "brands_insert_by_authenticated" ON "brands" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_on_brand_update_by_owner" ON "users_on_brand" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "users_on_brand_select_for_members" ON "users_on_brand" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_on_brand_delete_self" ON "users_on_brand" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_on_brand_delete_owner_non_owner" ON "users_on_brand" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "users_on_brand_insert_first_owner_self" ON "users_on_brand" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "brand_invites_update_by_owner" ON "brand_invites" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_invites_insert_by_owner" ON "brand_invites" AS PERMISSIVE FOR INSERT TO "authenticated";--> statement-breakpoint
CREATE POLICY "brand_invites_delete_by_owner" ON "brand_invites" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "brand_invites_select_for_recipient" ON "brand_invites" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "brand_invites_delete_by_recipient" ON "brand_invites" AS PERMISSIVE FOR DELETE TO "authenticated";--> statement-breakpoint
CREATE POLICY "brand_invites_select_for_members" ON "brand_invites" AS PERMISSIVE FOR SELECT TO "authenticated";--> statement-breakpoint
CREATE POLICY "categories_select_for_authenticated" ON "categories" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "categories_modify_system_only" ON "categories" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "brand_certifications_select_for_brand_members" ON "brand_certifications" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_insert_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_update_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_certifications_delete_by_brand_owner" ON "brand_certifications" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_select_for_brand_members" ON "brand_collections" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_insert_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_update_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_collections_delete_by_brand_owner" ON "brand_collections" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_select_for_brand_members" ON "brand_colors" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_insert_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_update_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_colors_delete_by_brand_owner" ON "brand_colors" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_select_for_brand_members" ON "brand_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_insert_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_update_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_eco_claims_delete_by_brand_owner" ON "brand_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_select_for_brand_members" ON "brand_facilities" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_insert_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_update_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_facilities_delete_by_brand_owner" ON "brand_facilities" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_select_for_brand_members" ON "brand_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_insert_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_update_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_materials_delete_by_brand_owner" ON "brand_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_select_for_brand_members" ON "brand_services" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_insert_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_update_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_services_delete_by_brand_owner" ON "brand_services" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_select_for_brand_members" ON "brand_sizes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_insert_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_update_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_sizes_delete_by_brand_owner" ON "brand_sizes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "care_codes_select_for_authenticated" ON "care_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "care_codes_modify_system_only" ON "care_codes" AS RESTRICTIVE FOR ALL TO "authenticated" USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "showcase_brands_select_for_brand_members" ON "showcase_brands" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_insert_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_update_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "showcase_brands_delete_by_brand_owner" ON "showcase_brands" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "products_select_for_brand_members" ON "products" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "products_insert_by_brand_owner" ON "products" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "products_update_by_brand_owner" ON "products" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "products_delete_by_brand_owner" ON "products" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "product_variants_select_for_brand_members" ON "product_variants" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_insert_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_update_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_variants_delete_by_brand_owner" ON "product_variants" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_materials_select_for_brand_members" ON "product_materials" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_insert_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_update_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_materials_delete_by_brand_owner" ON "product_materials" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_select_for_brand_members" ON "product_journey_steps" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_insert_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_update_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_journey_steps_delete_by_brand_owner" ON "product_journey_steps" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_environment_select_for_brand_members" ON "product_environment" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_insert_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_update_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_environment_delete_by_brand_owner" ON "product_environment" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    ));--> statement-breakpoint
CREATE POLICY "product_identifiers_select_for_brand_members" ON "product_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_insert_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_update_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_identifiers_delete_by_brand_owner" ON "product_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_select_for_brand_members" ON "product_variant_identifiers" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_insert_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_update_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_variant_identifiers_delete_by_brand_owner" ON "product_variant_identifiers" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_select_for_brand_members" ON "product_eco_claims" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_insert_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_update_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_eco_claims_delete_by_brand_owner" ON "product_eco_claims" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_select_for_brand_members" ON "product_care_codes" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_insert_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_update_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "product_care_codes_delete_by_brand_owner" ON "product_care_codes" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "file_assets_select_for_brand_members" ON "file_assets" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((brand_id IS NULL) OR is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_insert_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_update_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "file_assets_delete_by_brand_owner_or_system" ON "file_assets" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((brand_id IS NULL) OR is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_select_for_brand_members" ON "import_jobs" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_insert_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_update_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_jobs_delete_by_brand_owner" ON "import_jobs" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "import_rows_select_for_brand_members" ON "import_rows" AS PERMISSIVE FOR SELECT TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_member(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_insert_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_update_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "import_rows_delete_by_brand_owner" ON "import_rows" AS PERMISSIVE FOR DELETE TO "authenticated" USING (EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      ));--> statement-breakpoint
CREATE POLICY "value_mappings_select_for_brand_members" ON "value_mappings" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_insert_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_update_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_owner(brand_id));--> statement-breakpoint
CREATE POLICY "value_mappings_delete_by_brand_owner" ON "value_mappings" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_owner(brand_id));