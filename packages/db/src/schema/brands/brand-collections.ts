import { sql } from "drizzle-orm";
import {
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandCollections = pgTable(
  "brand_collections",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    description: text("description"),
    filter: jsonb("filter").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_collections_brand_name_unq").on(
      table.brandId,
      table.name,
    ),
    // RLS policies
    pgPolicy("brand_collections_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_collections_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_collections_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_collections_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);
