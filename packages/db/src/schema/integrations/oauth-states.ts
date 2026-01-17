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

/**
 * OAuth states table
 * Stores temporary OAuth state tokens for CSRF protection during OAuth flows
 *
 * This is used for Shopify OAuth (and potentially other OAuth providers).
 * States are short-lived (expire after 10 minutes) and are deleted after use.
 *
 * Only service_role can access this table (not authenticated users) because
 * OAuth callbacks are handled server-side without user authentication context.
 *
 * @see plan-integration.md Section 9 for Shopify OAuth flow details
 */
export const oauthStates = pgTable(
  "oauth_states",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /** The state token (random string for CSRF protection) */
    state: text("state").notNull(),
    /** Brand ID that initiated the OAuth flow */
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    /** Integration slug (e.g., "shopify") */
    integrationSlug: text("integration_slug").notNull(),
    /** Shop domain for Shopify (e.g., "my-store.myshopify.com") */
    shopDomain: text("shop_domain"),
    /** When this state expires (default: 10 minutes from creation) */
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for looking up by state token
    index("idx_oauth_states_state").on(table.state),
    // Index for cleanup of expired states
    index("idx_oauth_states_expires").on(table.expiresAt),
    // RLS policies - service_role only (no authenticated user access)
    // OAuth callbacks are handled server-side without user auth context
    pgPolicy("oauth_states_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("oauth_states_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("oauth_states_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("oauth_states_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
