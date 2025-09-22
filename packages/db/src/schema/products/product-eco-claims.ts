import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brandEcoClaims } from "../brands/brand-eco-claims";
import { products } from "./products";

export const productEcoClaims = pgTable(
  "product_eco_claims",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    ecoClaimId: uuid("eco_claim_id")
      .references(() => brandEcoClaims.id, {
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
    uniqueIndex("product_eco_claims_unique").on(
      table.productId,
      table.ecoClaimId,
    ),
    // RLS policies - inherit brand access through products relationship
    pgPolicy("product_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_eco_claims_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_eco_claims_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM products 
        WHERE products.id = product_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_eco_claims_delete_by_brand_owner", {
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
