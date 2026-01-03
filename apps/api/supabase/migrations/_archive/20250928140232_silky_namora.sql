ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_select_own_profile" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (auth.uid() = id);--> statement-breakpoint
CREATE POLICY "users_select_for_brand_members" ON "users" AS PERMISSIVE FOR SELECT TO "authenticated" USING (shares_brand_with(id));--> statement-breakpoint
CREATE POLICY "users_update_own_profile" ON "users" AS PERMISSIVE FOR UPDATE TO "authenticated" USING (auth.uid() = id) WITH CHECK (
        auth.uid() = id
        AND (
          brand_id IS NULL
          OR EXISTS (
            SELECT 1
            FROM brand_members uob
            WHERE uob.brand_id = brand_id
              AND uob.user_id = auth.uid()
          )
        )
      );--> statement-breakpoint
CREATE POLICY "users_insert_own_profile" ON "users" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (auth.uid() = id);