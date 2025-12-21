import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";
import { brandAttributeValues } from "../catalog/brand-attribute-values";

export const productVariantAttributes = pgTable(
  "product_variant_attributes",
  {
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    attributeValueId: uuid("attribute_value_id")
      .references(() => brandAttributeValues.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Composite primary key: variant + attribute value
    primaryKey({ columns: [table.variantId, table.attributeValueId], name: "product_variant_attributes_pkey" }),
    // Index for loading attributes by variant
    index("idx_product_variant_attributes_variant").on(table.variantId),
    // RLS policies - inherit brand access through product_variants → products relationship
    pgPolicy("product_variant_attributes_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_variant_attributes_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_variant_attributes_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_variant_attributes_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = variant_id
        AND is_brand_member(p.brand_id)
      )`,
    }),
  ],
);
