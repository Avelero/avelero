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
 * Supports two-phase workflow: validation/staging → user approval → production commit
 * @see prd.txt section 3.4 and section 5 for workflow details
 */
export const importJobs = pgTable(
  "import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    filename: text("filename").notNull(),
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
    status: text("status").notNull().default("PENDING"), // PENDING | VALIDATING | VALIDATED | COMMITTING | COMPLETED | FAILED | CANCELLED
    requiresValueApproval: boolean("requires_value_approval")
      .notNull()
      .default(false),
    summary: jsonb("summary"),
  },
  (table) => [
    // RLS policies
    pgPolicy("import_jobs_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("import_jobs_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("import_jobs_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("import_jobs_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);
