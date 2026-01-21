import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { productPassports } from "./product-passports";

/**
 * Product Passport Versions Table
 *
 * Immutable version history for product passports. Each publish action creates
 * a new record; records are NEVER updated or deleted. This provides a complete
 * audit trail of all passport content over time.
 *
 * The data_snapshot column contains a complete, self-contained JSON-LD object
 * that can be rendered without any additional database queries.
 *
 * Key design decisions:
 * - No cascade delete - versions are permanent audit records
 * - No UPDATE or DELETE RLS policies - versions are append-only
 * - content_hash enables integrity verification
 * - schema_version tracks the JSON structure version for migration purposes
 */
export const productPassportVersions = pgTable(
  "product_passport_versions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /**
     * Reference to the parent passport.
     * CRITICAL: No cascade delete - versions must persist indefinitely for compliance.
     */
    passportId: uuid("passport_id")
      .references(() => productPassports.id, {
        onDelete: "no action",
        onUpdate: "cascade",
      })
      .notNull(),
    /**
     * Sequential version number within this passport.
     * First version is 1, increments with each publish.
     */
    versionNumber: integer("version_number").notNull(),
    /**
     * Complete DPP content as a self-contained JSON-LD object.
     * Contains all product data, materials, supply chain, environmental info, etc.
     * This snapshot can render the passport without any additional queries.
     */
    dataSnapshot: jsonb("data_snapshot").notNull(),
    /**
     * SHA-256 hash of the canonical JSON representation of data_snapshot.
     * Used for integrity verification and to detect content changes.
     */
    contentHash: text("content_hash").notNull(),
    /**
     * Version of the JSON schema used for the snapshot.
     * Allows the system to correctly interpret and migrate older snapshots.
     * Format: "1.0", "1.1", "2.0", etc.
     */
    schemaVersion: text("schema_version").notNull(),
    /**
     * Timestamp when this version was published.
     * This is the immutable record of when this snapshot became active.
     */
    publishedAt: timestamp("published_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Unique constraint: only one version N per passport
    uniqueIndex("idx_product_passport_versions_passport_version").on(
      table.passportId,
      table.versionNumber,
    ),
    // Index for fetching all versions of a passport (for audit UI)
    index("idx_product_passport_versions_passport_id").using(
      "btree",
      table.passportId.asc().nullsLast().op("uuid_ops"),
    ),
    // Index for fetching latest version of a passport
    index("idx_product_passport_versions_passport_published").using(
      "btree",
      table.passportId.asc().nullsLast().op("uuid_ops"),
      table.publishedAt.desc().nullsLast().op("timestamptz_ops"),
    ),
    // RLS policies - brand members can read their passport versions
    // Note: Updates and deletes are NOT allowed - versions are immutable
    pgPolicy("product_passport_versions_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND is_brand_member(product_passports.brand_id)
      )`,
    }),
    pgPolicy("product_passport_versions_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND is_brand_member(product_passports.brand_id)
      )`,
    }),
    // Public read access for all versions (anyone can view via passport)
    pgPolicy("product_passport_versions_select_public", {
      as: "permissive",
      for: "select",
      to: ["anon"],
      using: sql`EXISTS (
        SELECT 1 FROM product_passports
        WHERE product_passports.id = passport_id
        AND product_passports.current_version_id IS NOT NULL
      )`,
    }),
  ],
);
