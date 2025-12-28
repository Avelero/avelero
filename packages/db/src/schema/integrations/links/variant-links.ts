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
import { brandIntegrations } from "../brand-integrations";
import { productVariants } from "../../products/product-variants";

/**
 * Integration variant links table
 * Maps Avelero product variants to external variant IDs.
 *
 * This is the PRIMARY link table for variant-level sync:
 * - SKU, EAN, GTIN, and barcode are stored on product_variants (not products)
 * - Variants are matched by these identifiers during sync
 * - Products are found/created through variants
 *
 * @see plan-integration.md Section 7.2.6 for architecture details
 */
export const integrationVariantLinks = pgTable(
  "integration_variant_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    variantId: uuid("variant_id")
      .references(() => productVariants.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** External variant ID (e.g., gid://shopify/ProductVariant/123) */
    externalId: text("external_id").notNull(),
    /** Parent product's external ID (for reference) */
    externalProductId: text("external_product_id"),
    /** Original SKU from external system (for debugging/audit) */
    externalSku: text("external_sku"),
    /** Original barcode from external system (for debugging/audit) */
    externalBarcode: text("external_barcode"),
    /** When this variant was last synced */
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      mode: "string",
    }),
    /** Hash of last synced data (for change detection) */
    lastSyncedHash: text("last_synced_hash"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique: one external variant per integration
    uniqueIndex("integration_variant_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    // Index for finding all links for a specific Avelero variant
    index("idx_integration_variant_links_variant").on(table.variantId),
    // Index for querying by integration
    index("idx_integration_variant_links_integration").on(
      table.brandIntegrationId,
    ),
    // RLS policies - access via brand_integrations join
    pgPolicy("integration_variant_links_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_variant_links_insert_by_service", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("integration_variant_links_update_by_service", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("integration_variant_links_delete_by_service", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
