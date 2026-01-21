import { sql } from "drizzle-orm";
import {
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { productVariants } from "./product-variants";

/**
 * Product Passports Table
 *
 * The permanent identity record for a passport. Once created, this record
 * persists regardless of changes to the underlying working data. This is the immutable
 * publishing layer that ensures QR codes remain resolvable indefinitely.
 *
 * Key design decisions:
 * - brand_id does NOT have cascade delete - passports persist even if brand is deleted
 * - working_variant_id uses ON DELETE SET NULL - link severed when variant deleted
 * - current_version_id will be set after first publish (references dpp_versions)
 * - status tracks whether passport is 'active' (linked to variant) or 'orphaned' (variant deleted)
 * - Orphaned passports retain their UPID and version history, but sku/barcode are cleared
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
     * Passport lifecycle status.
     * - 'active': Passport is linked to a working variant
     * - 'orphaned': Working variant was deleted; passport persists for QR code resolution
     */
    status: text("status").default("active").notNull(),
    /**
     * Timestamp when the passport became orphaned.
     * Set when working_variant_id becomes NULL due to variant deletion.
     * NULL for active passports.
     */
    orphanedAt: timestamp("orphaned_at", {
      withTimezone: true,
      mode: "string",
    }),
    /**
     * SKU preserved from the variant.
     * Copied on passport creation, cleared when passport is orphaned.
     */
    sku: text("sku"),
    /**
     * Barcode preserved from the variant.
     * Copied on passport creation, cleared when passport is orphaned.
     */
    barcode: text("barcode"),
    /**
     * Timestamp when the passport was first published.
     * Set once and never modified.
     */
    firstPublishedAt: timestamp("first_published_at", {
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
    // Note: UPID already has a unique constraint (line 37) which creates an index.
    // No need for an explicit uniqueIndex here.
    // Index for finding passports by brand
    index("idx_product_passports_brand_id").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    // Index for finding passport by working variant (used during publish)
    index("idx_product_passports_working_variant_id")
      .using("btree", table.workingVariantId.asc().nullsLast().op("uuid_ops"))
      .where(sql`working_variant_id IS NOT NULL`),
    // Index for filtering passports by status (active vs orphaned)
    index("idx_product_passports_status").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
    ),
    // Index for querying orphaned passports by orphan date
    index("idx_product_passports_orphaned_at")
      .using("btree", table.orphanedAt.desc().nullsLast().op("timestamptz_ops"))
      .where(sql`status = 'orphaned'`),
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
    // Visibility is controlled by the product's status:
    // - Orphaned passports (variant deleted): always visible if they have a version
    // - Active passports: only visible if the product's status is 'published'
    pgPolicy("product_passports_select_public", {
      as: "permissive",
      for: "select",
      to: ["anon"],
      using: sql`
        current_version_id IS NOT NULL
        AND (
          working_variant_id IS NULL
          OR
          EXISTS (
            SELECT 1 FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = working_variant_id
            AND p.status = 'published'
          )
        )
      `,
    }),
  ],
);
