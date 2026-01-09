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
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant-level weight data overrides.
 * When populated, these values take precedence over product_weight.
 * Mirrors the production variant_weight table structure.
 * 1:1 relationship with staging_product_variants.
 */
export const stagingVariantWeight = pgTable(
  "staging_variant_weight",
  {
    stagingVariantId: uuid("staging_variant_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    weight: numeric("weight", { precision: 10, scale: 2 }),
    weightUnit: text("weight_unit"), // 'g' | 'kg' | 'oz' | 'lb'
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_weight_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_weight_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_weight_select_for_brand_members", {
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
    pgPolicy("staging_variant_weight_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_weight_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_weight_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantWeightRelations = relations(
  stagingVariantWeight,
  ({ one }) => ({
    importJob: one(importJobs, {
      fields: [stagingVariantWeight.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantWeight.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
