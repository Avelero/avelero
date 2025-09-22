import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const valueMappings = pgTable(
  "value_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    sourceColumn: text("source_column").notNull(), // 'color','size','material_1_name','category_1', etc
    rawValue: text("raw_value").notNull(),
    target: text("target").notNull(), // 'COLOR','SIZE','MATERIAL','CATEGORY','ECO_CLAIM','FACILITY','SEASON','CARE_CODE'
    targetId: uuid("target_id").notNull(), // points to a brand_* or facility id
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("value_mappings_brand_col_raw_unq").on(
      table.brandId,
      table.sourceColumn,
      table.rawValue,
    ),
    // RLS policies
    pgPolicy("value_mappings_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("value_mappings_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("value_mappings_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("value_mappings_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);
