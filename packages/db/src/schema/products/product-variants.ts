import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
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
    upid: text("upid"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_variants_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
  ],
);