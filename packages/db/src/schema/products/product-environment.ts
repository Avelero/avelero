import { sql } from "drizzle-orm";
import {
  numeric,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products";

export const productEnvironment = pgTable(
  "product_environment",
  {
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    value: numeric("value", { precision: 12, scale: 4 }),
    unit: text("unit"),
    metric: text("metric").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Composite primary key: one row per product per metric type
    primaryKey({ columns: [table.productId, table.metric], name: "product_environment_pkey" }),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_environment_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_delete_by_brand_member", {
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
