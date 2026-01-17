import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const taxonomyCategories = pgTable(
  "taxonomy_categories",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    publicId: text("public_id").unique().notNull(),
    name: text("name").notNull(),
    parentId: uuid("parent_id").references(
      (): AnyPgColumn => taxonomyCategories.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("categories_parent_name_unq").on(table.parentId, table.name),
    index("categories_parent_id_idx").on(table.parentId),
    // RLS policies - global read-only data for authenticated users
    pgPolicy("categories_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
    // Only allow system/admin operations for modifications (restrict to superuser)
    pgPolicy("categories_modify_system_only", {
      as: "restrictive",
      for: "all",
      to: ["authenticated", "service_role"],
      using: sql`false`,
      withCheck: sql`false`,
    }),
  ],
);
