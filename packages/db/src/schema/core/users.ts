import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgPolicy,
  pgSchema,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

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
    index("idx_users_avatar_hue")
      .using("btree", table.avatarHue.asc().nullsLast().op("int2_ops"))
      .where(sql`(avatar_hue IS NOT NULL)`),
    pgPolicy("users_insert_by_service", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("select_own_profile", {
      as: "permissive",
      for: "select",
      to: ["public"],
    }),
    pgPolicy("update_own_profile", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
    }),
    pgPolicy("users_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
  ],
);
