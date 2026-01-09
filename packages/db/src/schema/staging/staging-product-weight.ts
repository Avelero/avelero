import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  numeric,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProducts } from "./staging-products";

/**
 * Staging table for product-level weight data.
 * Mirrors the production product_weight table structure.
 * 1:1 relationship with staging_products.
 */
export const stagingProductWeight = pgTable(
  "staging_product_weight",
  {
    stagingProductId: uuid("staging_product_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"), // 'g' | 'kg' | 'oz' | 'lb'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_weight_staging_product_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_weight_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_weight_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`EXISTS (
        SELECT 1
        FROM import_jobs
        WHERE import_jobs.id = job_id
          AND is_brand_member(import_jobs.brand_id)
      )`,
    }),
    pgPolicy("staging_product_weight_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_weight_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_weight_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductWeightRelations = relations(
  stagingProductWeight,
  ({ one }) => ({
    importJob: one(importJobs, {
      fields: [stagingProductWeight.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductWeight.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);
