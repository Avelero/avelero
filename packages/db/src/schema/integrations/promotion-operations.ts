import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { brandIntegrations } from "./brand-integrations";

/**
 * Promotion operation status values.
 * Tracks the current phase of a primary integration promotion.
 */
export type PromotionStatus =
  | "preparing"
  | "fetching"
  | "computing"
  | "creating_products"
  | "re_parenting"
  | "handling_orphans"
  | "archiving"
  | "updating_attributes"
  | "updating_links"
  | "cleanup"
  | "completed"
  | "failed";

/**
 * Promotion operations table
 * Tracks the progress of primary integration promotion operations.
 *
 * This enables:
 * - Resumability: If an operation fails, it can be resumed from the last checkpoint
 * - Progress tracking: UI can show progress to users
 * - Audit trail: Record of all promotion operations
 *
 * @see integration-refactor-plan.md Section 2.5 for algorithm details
 */
export const promotionOperations = pgTable(
  "promotion_operations",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    /** The integration being promoted to primary */
    newPrimaryIntegrationId: uuid("new_primary_integration_id")
      .references(() => brandIntegrations.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    /** The previous primary integration (null if none existed) */
    oldPrimaryIntegrationId: uuid("old_primary_integration_id").references(
      () => brandIntegrations.id,
      { onDelete: "set null", onUpdate: "cascade" },
    ),
    /**
     * Current status/phase of the operation.
     * Values: preparing, fetching, computing, creating_products, re_parenting,
     *         handling_orphans, archiving, updating_attributes, updating_links,
     *         cleanup, completed, failed
     */
    status: text("status").notNull().default("preparing"),
    /** Current phase number (0-11 matching algorithm phases) */
    phase: integer("phase").default(0).notNull(),
    /** Number of variants processed in the current batch operation */
    variantsProcessed: integer("variants_processed").default(0).notNull(),
    /** Total number of variants to process */
    totalVariants: integer("total_variants").default(0).notNull(),
    /** Number of products created during promotion */
    productsCreated: integer("products_created").default(0).notNull(),
    /** Number of products archived (empty after re-grouping) */
    productsArchived: integer("products_archived").default(0).notNull(),
    /** Number of variants moved between products */
    variantsMoved: integer("variants_moved").default(0).notNull(),
    /** Number of orphaned variants (not in new primary) */
    variantsOrphaned: integer("variants_orphaned").default(0).notNull(),
    /** Number of attributes created */
    attributesCreated: integer("attributes_created").default(0).notNull(),
    /** Error message if status is 'failed' */
    errorMessage: text("error_message"),
    /** When the operation was started */
    startedAt: timestamp("started_at", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    /** When the operation completed (successfully or failed) */
    completedAt: timestamp("completed_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // Index for querying by brand
    index("idx_promotion_operations_brand_id").on(table.brandId),
    // Index for finding incomplete operations (for resumability)
    index("idx_promotion_operations_status").on(table.status),
    // RLS policies - brand members can view their promotion operations
    pgPolicy("promotion_operations_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("promotion_operations_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("promotion_operations_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("promotion_operations_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
