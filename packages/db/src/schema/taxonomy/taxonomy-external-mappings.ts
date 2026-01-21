import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * External taxonomy mappings table.
 *
 * Stores resolved mappings from external systems (e.g., Shopify) to Avelero taxonomy.
 * The `data` column contains pre-resolved category UUIDs for fast in-memory lookups
 * during sync operations.
 */
export const taxonomyExternalMappings = pgTable(
  "taxonomy_external_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /** Unique slug for the mapping (e.g., "shopify-to-avelero") */
    slug: text("slug").notNull(),

    /** Source system identifier (e.g., "shopify") */
    sourceSystem: text("source_system").notNull(),
    /** Source taxonomy version (e.g., "shopify/2024-07") */
    sourceTaxonomy: text("source_taxonomy").notNull(),
    /** Target taxonomy version (e.g., "avelero/1.0") */
    targetTaxonomy: text("target_taxonomy").notNull(),
    /** Mapping file version */
    version: text("version").notNull(),

    /** Resolved mapping config JSON with category UUIDs */
    data: jsonb("data").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("taxonomy_external_mappings_slug_unq").on(table.slug),
    index("taxonomy_external_mappings_source_idx").on(
      table.sourceSystem,
      table.sourceTaxonomy,
    ),

    // Global read access for authenticated users
    pgPolicy("taxonomy_external_mappings_select_for_authenticated", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`true`,
    }),
  ],
);
