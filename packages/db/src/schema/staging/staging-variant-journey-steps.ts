import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandFacilities } from "../catalog/brand-facilities";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant-level journey step overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_journey_steps.
 * Mirrors the production variant_journey_steps table structure.
 */
export const stagingVariantJourneySteps = pgTable(
  "staging_variant_journey_steps",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    sortIndex: integer("sort_index").notNull(),
    stepType: text("step_type").notNull(), // raw-material, weaving, dyeing-printing, stitching, assembly, finishing
    facilityId: uuid("facility_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_variant_journey_steps_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_variant_journey_steps_staging_variant_id_idx").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_variant_journey_steps_unique").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
      table.sortIndex.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.facilityId],
      foreignColumns: [brandFacilities.id],
      name: "staging_variant_journey_steps_facility_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_journey_steps_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_journey_steps_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_journey_steps_select_for_brand_members", {
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
    pgPolicy("staging_variant_journey_steps_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_journey_steps_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_journey_steps_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantJourneyStepsRelations = relations(
  stagingVariantJourneySteps,
  ({ one }) => ({
    brandFacility: one(brandFacilities, {
      fields: [stagingVariantJourneySteps.facilityId],
      references: [brandFacilities.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingVariantJourneySteps.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantJourneySteps.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
