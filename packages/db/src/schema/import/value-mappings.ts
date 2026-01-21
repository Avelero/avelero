import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

/**
 * Value mappings table for bulk import.
 *
 * This table stores mappings from raw CSV column values to database entity IDs.
 * For example, mapping "Red" in a column to a specific material ID.
 * These mappings are brand-specific and can be reused across imports.
 */
export const valueMappings = pgTable(
  "value_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id").notNull(),
    sourceColumn: text("source_column").notNull(),
    rawValue: text("raw_value").notNull(),
    target: text("target").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("value_mappings_brand_col_raw_unq").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.sourceColumn.asc().nullsLast().op("text_ops"),
      table.rawValue.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandId],
      foreignColumns: [brands.id],
      name: "value_mappings_brand_id_brands_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("value_mappings_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("value_mappings_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("value_mappings_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("value_mappings_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);

export const valueMappingsRelations = relations(valueMappings, ({ one }) => ({
  brand: one(brands, {
    fields: [valueMappings.brandId],
    references: [brands.id],
  }),
}));
