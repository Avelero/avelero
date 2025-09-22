import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

export const careCodes = pgTable(
  "care_codes",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    iconUrl: text("icon_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("care_codes_code_unq").on(table.code),
    // RLS policies - global read-only data for authenticated users
    pgPolicy("care_codes_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`true`,
    }),
    // Only allow system/admin operations for modifications (restrict to superuser)
    pgPolicy("care_codes_modify_system_only", {
      as: "restrictive",
      for: "all",
      to: ["authenticated"],
      using: sql`false`,
      withCheck: sql`false`,
    }),
  ],
);
