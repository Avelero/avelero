import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { products } from "./products";

export const productIdentifiers = pgTable(
  "product_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    idType: text("id_type").notNull(),
    value: text("value").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("product_identifiers_product_type_value_unq").on(
      table.productId,
      table.idType,
      table.value,
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_identifiers_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_identifiers_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_identifiers_delete_by_brand_owner", {
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
