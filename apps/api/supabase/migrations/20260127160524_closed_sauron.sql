CREATE TABLE "pending_installations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_domain" text NOT NULL,
	"credentials" text NOT NULL,
	"credentials_iv" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pending_installations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "oauth_states" ALTER COLUMN "brand_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pending_installations_shop_domain_unq" ON "pending_installations" USING btree ("shop_domain");--> statement-breakpoint
CREATE INDEX "idx_pending_installations_expires" ON "pending_installations" USING btree ("expires_at");--> statement-breakpoint
CREATE POLICY "pending_installations_select_by_service_role" ON "pending_installations" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "pending_installations_insert_by_service_role" ON "pending_installations" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "pending_installations_update_by_service_role" ON "pending_installations" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "pending_installations_delete_by_service_role" ON "pending_installations" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);