import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgPolicy,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["owner", "member"]);

// Minimal auth schema to express the FK on users.id → auth.users(id)
const auth = pgSchema("auth");
const authUsers = auth.table("users", {
  id: uuid("id").primaryKey().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id")
      .references(() => authUsers.id, { onDelete: "cascade" })
      .primaryKey()
      .notNull(),
    email: text("email").notNull(),
    fullName: text("full_name"),
    avatarPath: text("avatar_path"),
    avatarHue: smallint("avatar_hue"),
    brandId: uuid("brand_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique("users_email_key").on(table.email),
    check(
      "users_avatar_hue_check",
      sql`(avatar_hue IS NULL) OR ((avatar_hue >= 1) AND (avatar_hue <= 360))`,
    ),
    // For filtering users by active brand (used in composite.workflowInit and brand deletion)
    index("idx_users_brand_id")
      .using("btree", table.brandId.asc().nullsLast().op("uuid_ops"))
      .where(sql`(brand_id IS NOT NULL)`),
    // RLS policies
    pgPolicy("users_select_own_profile", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`auth.uid() = id`,
    }),
    pgPolicy("users_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`shares_brand_with(id)`,
    }),
    pgPolicy("users_update_own_profile", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`auth.uid() = id`,
      withCheck: sql`
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
      `,
    }),
    pgPolicy("users_insert_own_profile", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`auth.uid() = id`,
    }),
  ],
);
