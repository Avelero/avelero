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
import { brandSeasons } from "../brands/brand-seasons";
import { categories } from "../brands/categories";
import { brandManufacturers } from "../brands/brand-manufacturers";
import { brands } from "../core/brands";

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    productIdentifier: text("product_identifier").notNull(),
    ean: text("ean"),
    gtin: text("gtin"),
    upid: text("upid"),
    description: text("description"),
    manufacturerId: uuid("manufacturer_id").references(
      () => brandManufacturers.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    primaryImagePath: text("primary_image_path"),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"),
    webshopUrl: text("webshop_url"),
    price: numeric("price", { precision: 10, scale: 2 }),
    currency: text("currency"),
    salesStatus: text("sales_status"),
    categoryId: uuid("category_id").references(() => categories.id, {
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
    // Unique constraint: product_identifier must be unique within each brand
    uniqueIndex("products_brand_id_product_identifier_unq").on(
      table.brandId,
      table.productIdentifier,
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
    // For products.getByUpid - lookup by UPID
    index("idx_products_brand_upid").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
      table.upid.asc().nullsLast().op("text_ops"),
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
