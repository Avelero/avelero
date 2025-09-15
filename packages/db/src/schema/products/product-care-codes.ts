import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { careCodes } from "../brands/care-codes";
import { products } from "./products";

export const productCareCodes = pgTable(
  "product_care_codes",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    careCodeId: uuid("care_code_id")
      .references(() => careCodes.id, {
        onDelete: "restrict",
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
    uniqueIndex("product_care_codes_unique").on(
      table.productId,
      table.careCodeId,
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_care_codes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_care_codes_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_care_codes_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_care_codes_delete_by_brand_owner", {
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
