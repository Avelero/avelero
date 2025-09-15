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
import { uniqueIndex } from "drizzle-orm/pg-core";
import { importJobs } from "./import-jobs";

export const importRows = pgTable(
  "import_rows",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    jobId: uuid("job_id")
      .references(() => importJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    rowNumber: integer("row_number").notNull(),
    raw: jsonb("raw").notNull(),
    normalized: jsonb("normalized"),
    error: text("error"),
    status: text("status").notNull().default("PENDING"), // PENDING MAPPED APPLIED FAILED
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("import_rows_job_row_unq").on(table.jobId, table.rowNumber),
    // RLS policies - inherit brand access through import job relationship
    pgPolicy("import_rows_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("import_rows_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("import_rows_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("import_rows_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`EXISTS (
        SELECT 1 FROM import_jobs 
        WHERE import_jobs.id = job_id 
        AND is_brand_owner(import_jobs.brand_id)
      )`,
    }),
  ],
);
