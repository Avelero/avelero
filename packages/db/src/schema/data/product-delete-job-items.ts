/**
 * Product delete job item schema.
 *
 * Snapshots the exact product IDs targeted by one background delete job so the
 * worker never depends on a live filter query while it is running.
 */

import { sql } from "drizzle-orm";
import { index, pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productDeleteJobs } from "./product-delete-jobs";

export const productDeleteJobItems = pgTable(
  "product_delete_job_items",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    jobId: uuid("job_id")
      .references(() => productDeleteJobs.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    productId: uuid("product_id").notNull(),
    status: text("status").notNull().default("PENDING"),
    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "string",
    }),
  },
  (table) => [
    index("idx_product_delete_job_items_job_status").on(table.jobId, table.status),
    pgPolicy("product_delete_job_items_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )`,
    }),
    pgPolicy("product_delete_job_items_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )`,
    }),
    pgPolicy("product_delete_job_items_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )`,
    }),
    pgPolicy("product_delete_job_items_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM product_delete_jobs
        WHERE product_delete_jobs.id = job_id
          AND is_brand_member(product_delete_jobs.brand_id)
      )`,
    }),
  ],
);
