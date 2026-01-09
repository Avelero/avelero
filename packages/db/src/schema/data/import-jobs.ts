import { sql } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

/**
 * Import jobs table for tracking bulk product import operations
 * Supports fire-and-forget workflow: validate → auto-commit successful rows
 * Status values: PENDING | PROCESSING | COMPLETED | COMPLETED_WITH_FAILURES | FAILED
 * Mode values:
 * - CREATE: Creates new products where handle doesn't exist, skips matching handles
 * - CREATE_AND_ENRICH: Creates new products AND enriches/updates matching products by handle + UPID
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    filename: text("filename").notNull(),
    /** Import mode: CREATE for new products (skips matching handles), CREATE_AND_ENRICH to also update matching products */
    mode: text("mode").notNull().default("CREATE"), // CREATE | CREATE_AND_ENRICH
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    finishedAt: timestamp("finished_at", {
      withTimezone: true,
      mode: "string",
    }),
    commitStartedAt: timestamp("commit_started_at", {
      withTimezone: true,
      mode: "string",
    }),
    status: text("status").notNull().default("PENDING"), // PENDING | PROCESSING | COMPLETED | COMPLETED_WITH_FAILURES | FAILED
    requiresValueApproval: boolean("requires_value_approval")
      .notNull()
      .default(false),
    /** Whether the job has failed rows that can be exported for correction */
    hasExportableFailures: boolean("has_exportable_failures")
      .notNull()
      .default(false),
    summary: jsonb("summary"),
  },
  (table) => [
    // RLS policies
    pgPolicy("import_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("import_jobs_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("import_jobs_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("import_jobs_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
