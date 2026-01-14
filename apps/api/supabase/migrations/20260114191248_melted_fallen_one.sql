CREATE TABLE "user_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"resource_type" text,
	"resource_id" uuid,
	"action_url" text,
	"action_data" jsonb,
	"seen_at" timestamp with time zone,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "user_notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_notifications" ADD CONSTRAINT "user_notifications_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "idx_user_notifications_user_unread" ON "user_notifications" USING btree ("user_id","brand_id") WHERE (seen_at IS NULL AND dismissed_at IS NULL);--> statement-breakpoint
CREATE INDEX "idx_user_notifications_expires" ON "user_notifications" USING btree ("expires_at") WHERE (expires_at IS NOT NULL);--> statement-breakpoint
CREATE INDEX "idx_user_notifications_resource" ON "user_notifications" USING btree ("resource_type","resource_id") WHERE (resource_type IS NOT NULL AND resource_id IS NOT NULL);--> statement-breakpoint
CREATE POLICY "user_notifications_select_own" ON "user_notifications" AS PERMISSIVE FOR SELECT TO "authenticated", "service_role" USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "user_notifications_insert_service" ON "user_notifications" AS PERMISSIVE FOR INSERT TO "service_role" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "user_notifications_update_own" ON "user_notifications" AS PERMISSIVE FOR UPDATE TO "authenticated", "service_role" USING (auth.uid() = user_id);--> statement-breakpoint
CREATE POLICY "user_notifications_delete_own" ON "user_notifications" AS PERMISSIVE FOR DELETE TO "authenticated", "service_role" USING (auth.uid() = user_id);