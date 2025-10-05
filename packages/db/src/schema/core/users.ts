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
    role: userRoleEnum("role").notNull().default("member"),
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
  ],
);
