import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { integrations } from "./integrations";

/**
 * Brand integrations table
 * Links a brand to an integration provider with credentials and settings
 *
 * Credentials are encrypted using AES-256-GCM before storage.
 * The encryption key is stored in INTEGRATION_ENCRYPTION_KEY env var.
 *
 * @see plan-integration.md for architecture details
 */
export const brandIntegrations = pgTable(
  "brand_integrations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    integrationId: uuid("integration_id")
      .references(() => integrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** Encrypted credentials (JSON string encrypted with AES-256-GCM) */
    credentials: text("credentials"),
    /** Initialization vector for AES-256-GCM decryption */
    credentialsIv: text("credentials_iv"),
    /** Shop domain for Shopify (e.g., "my-store.myshopify.com") */
    shopDomain: text("shop_domain"),
    /** Sync interval in seconds (default: 21600 = 6 hours) */
    syncInterval: integer("sync_interval").notNull().default(21600),
    /** Last successful sync timestamp */
    lastSyncAt: timestamp("last_sync_at", {
      withTimezone: true,
      mode: "string",
    }),
    /** Connection status */
    status: text("status").notNull().default("pending"), // 'pending' | 'active' | 'error' | 'paused' | 'disconnected'
    /** Error message if status is 'error' */
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: one integration per brand
    uniqueIndex("brand_integrations_brand_integration_unq").on(
      table.brandId,
      table.integrationId,
    ),
    // Index for querying by brand
    index("idx_brand_integrations_brand_id").on(table.brandId),
    // Index for querying by status (for scheduled sync jobs)
    index("idx_brand_integrations_status").on(table.status),
    // RLS policies - brand members can manage their integrations
    pgPolicy("brand_integrations_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_integrations_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
