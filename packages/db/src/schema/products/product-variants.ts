import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
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
    sku: text("sku"),
    upid: text("upid").notNull(),
    productImageUrl: text("product_image_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Performance indexes for product relationship queries
    productIdIdx: index("product_variants_product_id_idx").on(table.productId),
    productCreatedIdx: index("product_variants_product_created_idx").on(table.productId, table.createdAt),
    productUpdatedIdx: index("product_variants_product_updated_idx").on(table.productId, table.updatedAt),

    // Attribute filtering indexes
    colorIdIdx: index("product_variants_color_id_idx").on(table.colorId),
    sizeIdIdx: index("product_variants_size_id_idx").on(table.sizeId),
    colorSizeIdx: index("product_variants_color_size_idx").on(table.colorId, table.sizeId),

    // Identifier search indexes
    skuIdx: index("product_variants_sku_idx").on(table.sku),
    upidIdx: index("product_variants_upid_idx").on(table.upid),

    // Image tracking index
    imageUrlIdx: index("product_variants_image_url_idx").on(table.productImageUrl),

    // Temporal indexes for cursor pagination
    createdAtIdx: index("product_variants_created_at_idx").on(table.createdAt),
    updatedAtIdx: index("product_variants_updated_at_idx").on(table.updatedAt),

    // RLS policies - inherit brand access through products relationship
    productVariantsSelectForBrandMembers: pgPolicy("product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND is_brand_member(products.brand_id)
    )`,
    }),
    productVariantsInsertByBrandOwner: pgPolicy("product_variants_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND is_brand_member(products.brand_id)
    )`,
    }),
    productVariantsUpdateByBrandOwner: pgPolicy("product_variants_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND is_brand_member(products.brand_id)
    )`,
    }),
    productVariantsDeleteByBrandOwner: pgPolicy("product_variants_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products
      WHERE products.id = product_id
      AND is_brand_member(products.brand_id)
    )`,
    }),
  }),
);
