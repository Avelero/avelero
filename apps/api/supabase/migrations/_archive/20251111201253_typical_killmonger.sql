CREATE TABLE "brand_seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"start_date" date,
	"end_date" date,
	"ongoing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "brand_seasons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "staging_products" ADD COLUMN "season_id" uuid;--> statement-breakpoint
ALTER TABLE "brand_seasons" ADD CONSTRAINT "brand_seasons_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "brand_seasons_brand_name_unq" ON "brand_seasons" USING btree ("brand_id","name");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_season_id_brand_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."brand_seasons"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
-- NOTE: We are NOT dropping the old "season" text columns yet
-- They will be migrated in a separate data migration script
-- After data is migrated, run a follow-up migration to drop these columns:
-- ALTER TABLE "products" DROP COLUMN "season";
-- ALTER TABLE "staging_products" DROP COLUMN "season";
--> statement-breakpoint
CREATE POLICY "brand_seasons_select_for_brand_members" ON "brand_seasons" AS PERMISSIVE FOR SELECT TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_seasons_insert_by_brand_members" ON "brand_seasons" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_seasons_update_by_brand_members" ON "brand_seasons" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_seasons_delete_by_brand_members" ON "brand_seasons" AS PERMISSIVE FOR DELETE TO "authenticated" USING (is_brand_member(brand_id));