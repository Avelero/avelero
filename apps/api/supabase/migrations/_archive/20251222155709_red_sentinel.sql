CREATE TABLE "taxonomy_external_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"source_system" text NOT NULL,
	"source_taxonomy" text NOT NULL,
	"target_taxonomy" text NOT NULL,
	"version" text NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "taxonomy_external_mappings_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "taxonomy_external_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "product_environment" DROP CONSTRAINT "product_environment_pkey";--> statement-breakpoint
ALTER TABLE "product_environment" ALTER COLUMN "metric" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "product_environment" ADD CONSTRAINT "product_environment_pkey" PRIMARY KEY("product_id","metric");--> statement-breakpoint
CREATE UNIQUE INDEX "taxonomy_external_mappings_slug_unq" ON "taxonomy_external_mappings" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "taxonomy_external_mappings_source_idx" ON "taxonomy_external_mappings" USING btree ("source_system","source_taxonomy");--> statement-breakpoint
CREATE POLICY "taxonomy_external_mappings_select_for_authenticated" ON "taxonomy_external_mappings" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (true);--> statement-breakpoint
ALTER POLICY "users_update_own_profile" ON "users" TO authenticated,service_role USING (auth.uid() = id) WITH CHECK (
        auth.uid() = id
        AND (
          brand_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM brand_members bm
            WHERE bm.brand_id = brand_id
              AND bm.user_id = auth.uid()
          )
        )
      );