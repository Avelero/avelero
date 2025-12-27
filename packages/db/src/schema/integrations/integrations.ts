import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";

/**
 * Integration types master table
 * Stores available integration providers (e.g., "shopify", "its-perfect")
 * This is a system-level table, not brand-scoped
 *
 * @see plan-integration.md for architecture details
 */
export const integrations = pgTable(
  "integrations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /** Unique slug identifier (e.g., "shopify", "its-perfect") */
    slug: text("slug").notNull(),
    /** Display name (e.g., "Shopify", "It's Perfect") */
    name: text("name").notNull(),
    /** Description of the integration */
    description: text("description"),
    /** Authentication type required */
    authType: text("auth_type").notNull(), // 'oauth' | 'api_key' | 'api_key_secret'
    /** Path to integration icon (relative to assets) */
    iconPath: text("icon_path"),
    /** Integration status */
    status: text("status").notNull().default("active"), // 'active' | 'beta' | 'deprecated' | 'disabled'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint on slug
    uniqueIndex("integrations_slug_unq").on(table.slug),
    // RLS policies - all authenticated users can read integrations
    pgPolicy("integrations_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
    // Only service_role can modify integrations (admin operations)
    pgPolicy("integrations_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("integrations_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("integrations_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
