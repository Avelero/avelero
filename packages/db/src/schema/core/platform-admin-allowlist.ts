import { sql } from "drizzle-orm";
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const platformAdminAllowlist = pgTable(
  "platform_admin_allowlist",
  {
    email: text("email").primaryKey().notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("ux_platform_admin_allowlist_user_id_not_null")
      .on(table.userId)
      .where(sql`(user_id IS NOT NULL)`),
    pgPolicy("platform_admin_allowlist_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("platform_admin_allowlist_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("platform_admin_allowlist_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("platform_admin_allowlist_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
