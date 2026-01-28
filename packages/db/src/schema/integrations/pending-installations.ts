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

/**
 * Pending installations table
 * Stores Shopify installations that haven't been claimed by an Avelero account yet.
 *
 * This is used when a user installs from the Shopify App Store first,
 * before logging into Avelero. The installation is stored here temporarily
 * until the user logs in and claims it for their brand.
 *
 * Installations expire after 24 hours if not claimed.
 *
 * Only service_role can access this table (OAuth callbacks are unauthenticated).
 */
export const pendingInstallations = pgTable(
  "pending_installations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /** Shop domain (e.g., "my-store.myshopify.com") */
    shopDomain: text("shop_domain").notNull(),
    /** Encrypted credentials (JSON string encrypted with AES-256-GCM) */
    credentials: text("credentials").notNull(),
    /** Initialization vector for AES-256-GCM decryption */
    credentialsIv: text("credentials_iv").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    /** When this installation expires (default: 24 hours from creation) */
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
  },
  (table) => [
    // Unique constraint: one pending installation per shop
    uniqueIndex("pending_installations_shop_domain_unq").on(table.shopDomain),
    // Index for cleanup of expired installations
    index("idx_pending_installations_expires").on(table.expiresAt),
    // RLS policies - service_role only (no authenticated user access)
    // OAuth callbacks are handled server-side without user auth context
    pgPolicy("pending_installations_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("pending_installations_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("pending_installations_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("pending_installations_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
