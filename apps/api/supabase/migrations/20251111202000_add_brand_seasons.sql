-- Create brand_seasons table
CREATE TABLE IF NOT EXISTS "brand_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"ongoing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE "brand_seasons" ENABLE ROW LEVEL SECURITY;

-- Add foreign key constraint
ALTER TABLE "brand_seasons" 
ADD CONSTRAINT "brand_seasons_brand_id_brands_id_fk" 
FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") 
ON DELETE cascade ON UPDATE cascade;

-- Add unique index
CREATE UNIQUE INDEX IF NOT EXISTS "brand_seasons_brand_name_unq" 
ON "brand_seasons" USING btree ("brand_id","name");

-- Add season_id columns (keeping old season text columns for now)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "season_id" uuid;
ALTER TABLE "staging_products" ADD COLUMN IF NOT EXISTS "season_id" uuid;

-- Add foreign key for products.season_id
ALTER TABLE "products" 
ADD CONSTRAINT "products_season_id_brand_seasons_id_fk" 
FOREIGN KEY ("season_id") REFERENCES "public"."brand_seasons"("id") 
ON DELETE set null ON UPDATE cascade;

-- Create RLS policies
CREATE POLICY "brand_seasons_select_for_brand_members" 
ON "brand_seasons" AS PERMISSIVE FOR SELECT TO "authenticated" 
USING (is_brand_member(brand_id));

CREATE POLICY "brand_seasons_insert_by_brand_members" 
ON "brand_seasons" AS PERMISSIVE FOR INSERT TO "authenticated" 
WITH CHECK (is_brand_member(brand_id));

CREATE POLICY "brand_seasons_update_by_brand_members" 
ON "brand_seasons" AS PERMISSIVE FOR UPDATE TO "authenticated" 
USING (is_brand_member(brand_id));

CREATE POLICY "brand_seasons_delete_by_brand_members" 
ON "brand_seasons" AS PERMISSIVE FOR DELETE TO "authenticated" 
USING (is_brand_member(brand_id));

-- NOTE: The old "season" text columns in products and staging_products are kept for now
-- Data migration will be done separately to:
-- 1. Create season records from existing text values
-- 2. Populate season_id based on season text
-- 3. Drop the old season columns in a follow-up migration
