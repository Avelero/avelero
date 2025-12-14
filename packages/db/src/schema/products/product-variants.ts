import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brandColors } from "../brands/brand-colors";
import { brandSizes } from "../brands/brand-sizes";
import { products } from "./products";

export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    colorId: uuid("color_id").references(() => brandColors.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    sizeId: uuid("size_id").references(() => brandSizes.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    gender: text("gender"),
    ean: text("ean"),
    gtin: text("gtin"),
    barcode: text("barcode"),
    sku: text("sku"),
    upid: text("upid"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Indexes for query performance
    // For loadVariantsForProducts - batch loading variants
    index("idx_product_variants_product_id").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
    ),
    // For ordering variants by createdAt
    index("idx_product_variants_product_created").using(
      "btree",
      table.productId.asc().nullsLast().op("uuid_ops"),
      table.createdAt.asc().nullsLast().op("timestamptz_ops"),
    ),
    // For UPID uniqueness checks during variant creation
    index("idx_product_variants_upid")
      .using("btree", table.upid.asc().nullsLast().op("text_ops"))
      .where(sql`(upid IS NOT NULL)`),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
  ],
);
