CREATE TABLE "platform_admin_allowlist" (
	"email" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "platform_admin_allowlist" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "platform_admin_allowlist" ADD CONSTRAINT "platform_admin_allowlist_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "ux_platform_admin_allowlist_user_id_not_null" ON "platform_admin_allowlist" USING btree ("user_id") WHERE (user_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "platform_admin_allowlist_select_by_service_role" ON "platform_admin_allowlist" AS PERMISSIVE FOR SELECT TO "service_role" USING (true);--> statement-breakpoint
CREATE POLICY "platform_admin_allowlist_insert_by_service_role" ON "platform_admin_allowlist" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_admin_allowlist_update_by_service_role" ON "platform_admin_allowlist" AS PERMISSIVE FOR UPDATE TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "platform_admin_allowlist_delete_by_service_role" ON "platform_admin_allowlist" AS PERMISSIVE FOR DELETE TO "service_role" USING (true);