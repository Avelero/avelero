import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brandIntegrations } from "./brand-integrations";

/**
 * Integration sync jobs table
 * Tracks sync job history and statistics for each integration
 *
 * @see plan-integration.md for architecture details
 */
export const integrationSyncJobs = pgTable(
  "integration_sync_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandIntegrationId: uuid("brand_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** Sync job status */
    status: text("status").notNull().default("pending"), // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
    /** Trigger type */
    triggerType: text("trigger_type").notNull().default("scheduled"), // 'scheduled' | 'manual' | 'webhook'
    /** When the job started processing */
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
    /** When the job finished (success or failure) */
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    // ===================
    // VARIANT-LEVEL STATS (primary sync target)
    // ===================
    /** Number of variants processed */
    variantsProcessed: integer("variants_processed").notNull().default(0),
    /** Number of variants created */
    variantsCreated: integer("variants_created").notNull().default(0),
    /** Number of variants updated */
    variantsUpdated: integer("variants_updated").notNull().default(0),
    /** Number of variants that failed to process */
    variantsFailed: integer("variants_failed").notNull().default(0),
    /** Number of variants skipped (no changes) */
    variantsSkipped: integer("variants_skipped").notNull().default(0),
    // ===================
    // PRODUCT-LEVEL STATS (created/updated through variants)
    // ===================
    /** Total number of products to process (for progress calculation) */
    productsTotal: integer("products_total"),
    /** Number of products processed */
    productsProcessed: integer("products_processed").notNull().default(0),
    /** Number of products created */
    productsCreated: integer("products_created").notNull().default(0),
    /** Number of products updated */
    productsUpdated: integer("products_updated").notNull().default(0),
    /** Number of products that failed to process */
    productsFailed: integer("products_failed").notNull().default(0),
    /** Number of products skipped (no changes) */
    productsSkipped: integer("products_skipped").notNull().default(0),
    /** Number of entities created (seasons, materials, etc.) */
    entitiesCreated: integer("entities_created").notNull().default(0),
    /** Error summary (if any errors occurred) */
    errorSummary: text("error_summary"),
    /** Detailed error log (JSON array of errors) */
    errorLog: jsonb("error_log"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for querying by integration
    index("idx_integration_sync_jobs_integration").on(table.brandIntegrationId),
    // Index for querying by status (for monitoring)
    index("idx_integration_sync_jobs_status").on(table.status),
    // Index for querying recent jobs
    index("idx_integration_sync_jobs_created").on(table.createdAt),
    // RLS policies - access via brand_integrations join
    pgPolicy("integration_sync_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_sync_jobs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_sync_jobs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1 FROM brand_integrations bi
        WHERE bi.id = brand_integration_id
        AND is_brand_member(bi.brand_id)
      )`,
    }),
    pgPolicy("integration_sync_jobs_delete_by_brand_member", {
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
