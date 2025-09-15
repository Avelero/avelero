import { sql } from "drizzle-orm";
import {
  numeric,
  pgPolicy,
  pgTable,
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
      .primaryKey()
      .notNull(),
    carbonKgCo2e: numeric("carbon_kg_co2e", { precision: 6, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 6, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_environment_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_member(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    )`,
    }),
    pgPolicy("product_environment_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
      SELECT 1 FROM products 
      WHERE products.id = product_id 
      AND is_brand_owner(products.brand_id)
    )`,
    }),
  ],
);
