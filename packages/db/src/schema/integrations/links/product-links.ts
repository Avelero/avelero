import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "../../products/products";
import { brandIntegrations } from "../brand-integrations";

/**
 * Integration product links table
 * Maps external product IDs to Avelero product IDs for each integration
 *
 * This enables:
 * - Matching existing products during sync (no duplicates)
 * - Tracking which products came from which integration
 * - Preserving links even if external IDs change
 *
 * @see plan-integration.md for architecture details
 */
export const integrationProductLinks = pgTable(
  "integration_product_links",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    productId: uuid("product_id")
      .references(() => products.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** External ID from the integration (e.g., Shopify product ID) */
    externalId: text("external_id").notNull(),
    /** External name/title from the integration (for reference/debugging) */
    externalName: text("external_name"),
    /** When this product was last synced */
    lastSyncedAt: timestamp("last_synced_at", {
      withTimezone: true,
      mode: "string",
    }),
    /** Hash of last synced data (for change detection - includes product fields + tags) */
    lastSyncedHash: text("last_synced_hash"),
    /**
     * Whether this source product is the canonical source for product-level data within this integration.
     * When multiple external products (from the same integration) map to one Avelero product,
     * only the canonical one writes to product-level fields; others write to variant overrides.
     * Defaults to true so existing links and first-linked products are canonical.
     */
    isCanonical: boolean("is_canonical").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: one external ID per integration
    uniqueIndex("integration_product_links_integration_external_unq").on(
      table.brandIntegrationId,
      table.externalId,
    ),
    // NOTE: We intentionally do NOT have a unique constraint on (brandIntegrationId, productId).
    // This allows many-to-one mappings where multiple external products link to the same Avelero product.
    // The isCanonical column determines which link writes to product-level data.
    // Index for looking up by product
    index("idx_integration_product_links_product").on(table.productId),
    // RLS policies - access via brand_integrations join
    pgPolicy("integration_product_links_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_product_links_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_product_links_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_product_links_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
  ],
);
