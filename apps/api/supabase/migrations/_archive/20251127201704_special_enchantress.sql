CREATE TABLE "brand_theme" (
	"brand_id" uuid NOT NULL,
	"theme_styles" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"theme_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"stylesheet_path" text,
	"google_fonts_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_theme_brand_id_pkey" PRIMARY KEY("brand_id")
);
--> statement-breakpoint
ALTER TABLE "brand_theme" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "brand_theme" ADD CONSTRAINT "brand_theme_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_brand_theme_updated_at" ON "brand_theme" USING btree ("updated_at");--> statement-breakpoint
CREATE POLICY "brand_theme_select_for_brand_members" ON "brand_theme" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_theme_insert_by_brand_member" ON "brand_theme" AS PERMISSIVE FOR INSERT TO "authenticated", "service_role" WITH CHECK (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_theme_update_by_brand_member" ON "brand_theme" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (is_brand_member(brand_id));--> statement-breakpoint
CREATE POLICY "brand_theme_delete_by_brand_member" ON "brand_theme" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (is_brand_member(brand_id));