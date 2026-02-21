import { sql } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { users } from "../core/users";

/**
 * QR export jobs table for tracking bulk QR code export operations.
 *
 * Status values: PENDING | PROCESSING | COMPLETED | FAILED
 *
 * Selection modes:
 * - 'all': Export all products matching filters, optionally excluding some IDs
 * - 'explicit': Export only the explicitly specified product IDs
 */
export const qrExportJobs = pgTable(
  "qr_export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),

    // Brand and user context
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    userEmail: text("user_email").notNull(), // For email notification

    // Status tracking
    status: text("status").notNull().default("PENDING"), // PENDING | PROCESSING | COMPLETED | FAILED

    // Selection criteria (preserved from request)
    selectionMode: text("selection_mode").notNull(), // 'all' | 'explicit'
    includeIds: text("include_ids").array(), // When mode = 'explicit'
    excludeIds: text("exclude_ids").array(), // When mode = 'all'

    // Filter state (JSON blob to preserve exact filter configuration)
    filterState: jsonb("filter_state"),
    searchQuery: text("search_query"),

    // Verified domain snapshot used for GS1 URL generation
    customDomain: text("custom_domain").notNull(),

    // Progress tracking
    totalProducts: integer("total_products").default(0),
    totalVariants: integer("total_variants").default(0),
    eligibleVariants: integer("eligible_variants").default(0),
    variantsProcessed: integer("variants_processed").default(0),

    // Result
    filePath: text("file_path"), // Path in storage bucket
    downloadUrl: text("download_url"), // Signed URL
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }), // When download URL expires

    // Timestamps
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),

    // Summary/errors
    summary: jsonb("summary"),
  },
  () => [
    // RLS policies
    pgPolicy("qr_export_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("qr_export_jobs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("qr_export_jobs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("qr_export_jobs_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
