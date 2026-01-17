import { sql } from "drizzle-orm";
import {
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";

/**
 * Variant-level weight data overrides.
 * When populated, these values take precedence over product_weight for DPP rendering.
 */
export const variantWeight = pgTable(
  "variant_weight",
  {
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .primaryKey()
      .notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"),
    // Source tracking: which integration wrote this data
    sourceIntegration: text("source_integration"),
    sourceExternalId: text("source_external_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies - inherit brand access through product_variants → products relationship
    pgPolicy("variant_weight_select_for_brand_members", {
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
    pgPolicy("variant_weight_insert_by_brand_member", {
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
    pgPolicy("variant_weight_update_by_brand_member", {
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
    pgPolicy("variant_weight_delete_by_brand_member", {
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
