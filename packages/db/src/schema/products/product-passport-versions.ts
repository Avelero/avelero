/**
 * Product passport version schema.
 */

import { sql } from "drizzle-orm";
import {
  check,
  customType,
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
 * Postgres bytea column mapped to a Node Buffer.
 */
const bytea = customType<{
  data: Buffer;
  driverData: Buffer | Uint8Array | string;
}>({
  dataType() {
    return "bytea";
  },
  toDriver(value) {
    // Forward binary data directly to postgres.js.
    return value;
  },
  fromDriver(value) {
    // Normalize driver bytea values into a Buffer for compression helpers.
    if (Buffer.isBuffer(value)) {
      return value;
    }
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (typeof value === "string") {
      if (value.startsWith("\\x")) {
        return Buffer.from(value.slice(2), "hex");
      }
      return Buffer.from(value, "base64");
    }
    return Buffer.from([]);
  },
});

/**
 * Product Passport Versions Table
 *
 * Immutable version history for active product passports. Versions are append-only
 * while a passport exists, and cascade away when the parent passport is deleted.
 */
export const productPassportVersions = pgTable(
  "product_passport_versions",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    /**
     * Reference to the parent passport.
     */
    passportId: uuid("passport_id")
      .references(() => productPassports.id, {
        onDelete: "cascade",
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
     * Nullable once the snapshot has been compressed into compressed_snapshot.
     */
    dataSnapshot: jsonb("data_snapshot"),
    /**
     * Zstd-compressed historical snapshot payload.
     * Populated only for superseded versions after the compression job runs.
     */
    compressedSnapshot: bytea("compressed_snapshot"),
    /**
     * Timestamp when the JSON snapshot was compressed into bytea storage.
     */
    compressedAt: timestamp("compressed_at", {
      withTimezone: true,
      mode: "string",
    }),
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
    // Require every version row to keep either live JSON or compressed bytes.
    check(
      "product_passport_versions_snapshot_presence_check",
      sql`num_nonnulls(${table.dataSnapshot}, ${table.compressedSnapshot}) = 1`,
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
    // RLS policies - brand members can read their passport versions.
    pgPolicy("product_passport_versions_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    pgPolicy("product_passport_versions_insert_by_brand_members", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND is_brand_member(p.brand_id)
      )`,
    }),
    // Public read access for all versions of an active published passport.
    pgPolicy("product_passport_versions_select_public", {
      as: "permissive",
      for: "select",
      to: ["anon"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_passports pp
        JOIN product_variants pv ON pv.id = pp.working_variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE pp.id = passport_id
          AND pp.current_version_id IS NOT NULL
          AND p.status = 'published'
      )`,
    }),
  ],
);
