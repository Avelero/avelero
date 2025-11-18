import { relations } from "drizzle-orm";
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
import { importJobs } from "../data/import-jobs";
import { brandFacilities } from "../brands/brand-facilities";
import { stagingProducts } from "./staging-products";

export const stagingProductJourneySteps = pgTable(
  "staging_product_journey_steps",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    sortIndex: integer("sort_index").notNull(),
    stepType: text("step_type").notNull(),
    facilityId: uuid("facility_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_journey_steps_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_journey_steps_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_journey_steps_unique").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("int4_ops"),
      table.sortIndex.asc().nullsLast().op("int4_ops"),
    ),
    foreignKey({
      columns: [table.facilityId],
      foreignColumns: [brandFacilities.id],
      name: "staging_product_journey_steps_facility_id_brand_facilities_id_f",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_journey_steps_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_journey_steps_staging_product_id_staging_produc",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_journey_steps_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_journey_steps_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_journey_steps_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("staging_product_journey_steps_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductJourneyStepsRelations = relations(
  stagingProductJourneySteps,
  ({ one }) => ({
    brandFacility: one(brandFacilities, {
      fields: [stagingProductJourneySteps.facilityId],
      references: [brandFacilities.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProductJourneySteps.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductJourneySteps.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);

