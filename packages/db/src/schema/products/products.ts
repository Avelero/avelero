import { sql } from "drizzle-orm";
import {
  index,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandSeasons } from "../catalog/brand-seasons";
import { taxonomyCategories } from "../taxonomy/taxonomy-categories";
import { brandManufacturers } from "../catalog/brand-manufacturers";
import { brands } from "../core/brands";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    productHandle: text("product_handle").notNull(),
    description: text("description"),
    manufacturerId: uuid("manufacturer_id").references(
      () => brandManufacturers.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    imagePath: text("image_path"),
    categoryId: uuid("category_id").references(() => taxonomyCategories.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    seasonId: uuid("season_id").references(() => brandSeasons.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    status: text("status").notNull().default("unpublished"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: product_handle must be unique within each brand
    uniqueIndex("products_brand_id_product_handle_unq").on(
      table.brandId,
      table.productHandle,
    ),
    // Indexes for query performance
    // For products.list - filtering by brand
    index("idx_products_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    // For summary.productStatus - GROUP BY status
    index("idx_products_brand_status").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.status.asc().nullsLast().op("text_ops"),
    ),
    // For products.list - ordering by createdAt DESC
    index("idx_products_brand_created").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.desc().nullsLast().op("timestamptz_ops"),
    ),
    // For products.getByProductHandle - lookup by product handle
    index("idx_products_brand_product_handle").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.productHandle.asc().nullsLast().op("text_ops"),
    ),
    // For products.list - filtering by category
    index("idx_products_brand_category").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.categoryId.asc().nullsLast().op("uuid_ops"),
    ),
    // For products.list - filtering by season
    index("idx_products_brand_season").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.seasonId.asc().nullsLast().op("uuid_ops"),
    ),
    // For products.list - ILIKE search on name
    index("idx_products_brand_name").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.name.asc().nullsLast().op("text_ops"),
    ),
    // For queries filtering by name alone (count by name)
    index("idx_products_name").using("btree", table.name.asc().nullsLast().op("text_ops")),
    // RLS policies - both members and owners can perform all operations
    pgPolicy("products_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_update_by_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("products_delete_by_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
