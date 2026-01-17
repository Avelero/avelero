import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { productVariants } from "./product-variants";

/**
 * Product Passports Table
 *
 * The permanent identity record for a published passport. Once created, this record
 * persists regardless of changes to the underlying working data. This is the immutable
 * publishing layer that ensures QR codes remain resolvable indefinitely.
 *
 * Key design decisions:
 * - brand_id does NOT have cascade delete - passports persist even if brand is deleted
 * - working_variant_id uses ON DELETE SET NULL - link severed when variant deleted
 * - current_version_id will be set after first publish (references dpp_versions)
 */
export const productPassports = pgTable(
  "product_passports",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /**
     * Universal Product Identifier - globally unique identifier used in public URLs.
     * Format: 16-24 character alphanumeric string (e.g., "771Gh4J11gLj345m").
     * This is the sole identifier in the public URL: passport.avelero.com/{upid}
     */
    upid: text("upid").notNull().unique(),
    /**
     * Reference to the brand that owns this passport.
     * CRITICAL: No cascade delete - passports must persist even if brand is deleted.
     */
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "no action",
        onUpdate: "cascade",
      })
      .notNull(),
    /**
     * Reference to the working variant in the editable layer.
     * Becomes NULL if the variant is deleted (ON DELETE SET NULL).
     * When NULL, the passport still renders using the last published version.
     */
    workingVariantId: uuid("working_variant_id").references(
      () => productVariants.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    /**
     * Reference to the currently active/latest published version.
     * Points to dpp_versions.id. Set after first publish.
     * Note: Cannot use FK reference here due to circular dependency with dpp_versions.
     * Will be enforced via application logic.
     */
    currentVersionId: uuid("current_version_id"),
    /**
     * Timestamp when the passport was first published.
     * Set once and never modified.
     */
    firstPublishedAt: timestamp("first_published_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    /**
     * Timestamp when the passport was most recently published.
     * Updated on each new version publish.
     */
    lastPublishedAt: timestamp("last_published_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique index on UPID for fast lookups (primary public access pattern)
    uniqueIndex("idx_product_passports_upid").on(table.upid),
    // Index for finding passports by brand
    index("idx_product_passports_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    // Index for finding passport by working variant (used during publish)
    index("idx_product_passports_working_variant_id")
      .using("btree", table.workingVariantId.asc().nullsLast().op("uuid_ops"))
      .where(sql`working_variant_id IS NOT NULL`),
    // RLS policies - brand members can manage their brand's passports
    pgPolicy("product_passports_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_passports_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_passports_update_by_brand_members", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("product_passports_delete_by_brand_members", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    // Public read access for published passports (anyone can view via UPID)
    pgPolicy("product_passports_select_public", {
      as: "permissive",
      for: "select",
      to: ["anon"],
      using: sql`current_version_id IS NOT NULL`,
    }),
  ],
);
