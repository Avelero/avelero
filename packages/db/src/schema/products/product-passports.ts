/**
 * Product passport publish-state schema.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants";

/**
 * Product Passports Table
 *
 * Stores publish-state for a single working variant.
 * The variant owns the public identifiers; the passport only tracks publish metadata.
 */
export const productPassports = pgTable(
  "product_passports",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /** Parent working variant. Deleting the variant deletes the passport. */
    workingVariantId: uuid("working_variant_id").references(
      () => productVariants.id,
      {
        onDelete: "cascade",
        onUpdate: "cascade",
      },
    )
      .notNull(),
    /**
     * Reference to the currently active/latest published version.
     * Points to dpp_versions.id. Set after first publish.
     * Note: Cannot use FK reference here due to circular dependency with dpp_versions.
     * Will be enforced via application logic.
     */
    currentVersionId: uuid("current_version_id"),
    /**
     * Dirty flag indicating the working data has diverged from the published snapshot.
     * The projector clears this after it materializes a fresh version.
     */
    dirty: boolean("dirty").default(false).notNull(),
    /**
     * Timestamp when the passport was first published.
     * NULL until the first immutable version is actually materialized.
     */
    firstPublishedAt: timestamp("first_published_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Enforce one passport per working variant.
    uniqueIndex("idx_product_passports_working_variant_id")
      .using("btree", table.workingVariantId.asc().nullsLast().op("uuid_ops"))
      .where(sql`working_variant_id IS NOT NULL`),
    // Index for efficiently scanning dirty passports for projection.
    index("idx_product_passports_dirty")
      .using("btree", table.dirty.asc().nullsLast().op("bool_ops"))
      .where(sql`dirty = true`),
    // RLS policies - brand members can manage their brand's passports
    pgPolicy("product_passports_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_passports_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_passports_update_by_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_passports_delete_by_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = working_variant_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    // Public read access only while the linked variant exists and its product is published.
    pgPolicy("product_passports_select_public", {
      as: "permissive",
      for: "select",
      to: ["anon"],
      using: sql`current_version_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE pv.id = working_variant_id
            AND p.status = 'published'
        )`,
    }),
  ],
);
