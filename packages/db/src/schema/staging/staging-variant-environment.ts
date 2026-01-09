import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant-level environment data overrides.
 * When populated, these values take precedence over product_environment.
 * Mirrors the production variant_environment table structure.
 * 1:1 relationship with staging_product_variants.
 */
export const stagingVariantEnvironment = pgTable(
  "staging_variant_environment",
  {
    stagingVariantId: uuid("staging_variant_id").primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    carbonKgCo2e: numeric("carbon_kg_co2e", { precision: 12, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 12, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_environment_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_environment_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_environment_select_for_brand_members", {
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
    pgPolicy("staging_variant_environment_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_environment_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_environment_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantEnvironmentRelations = relations(
  stagingVariantEnvironment,
  ({ one }) => ({
    importJob: one(importJobs, {
      fields: [stagingVariantEnvironment.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantEnvironment.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
