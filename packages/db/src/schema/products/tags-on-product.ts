import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandTags } from "../brands/brand-tags";
import { products } from "./products";

export const tagsOnProduct = pgTable(
  "tags_on_product",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    tagId: uuid("tag_id")
      .references(() => brandTags.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: prevent duplicate tag assignments
    uniqueIndex("tags_on_product_tag_product_unq").on(
      table.tagId,
      table.productId,
    ),
    // Indexes for efficient queries
    index("tags_on_product_tag_id_idx").on(table.tagId),
    index("tags_on_product_product_id_idx").on(table.productId),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("tags_on_product_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("tags_on_product_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("tags_on_product_delete_by_brand_members", {
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
