import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";

export const productVariantIdentifiers = pgTable(
  "product_variant_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
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
    uniqueIndex("product_variant_identifiers_product_type_value_unq").on(
      table.variantId,
      table.idType,
      table.value,
    ),
    // RLS policies - inherit brand access through product-variants -> products relationship
    pgPolicy("product_variant_identifiers_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_member(products.brand_id)
      )`,
    }),
    pgPolicy("product_variant_identifiers_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_variant_identifiers_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
    pgPolicy("product_variant_identifiers_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants 
        JOIN products ON products.id = product_variants.product_id
        WHERE product_variants.id = variant_id 
        AND is_brand_owner(products.brand_id)
      )`,
    }),
  ],
);
