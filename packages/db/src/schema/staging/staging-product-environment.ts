import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  numeric,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { stagingProducts } from "./staging-products";

export const stagingProductEnvironment = pgTable(
  "staging_product_environment",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    carbonKgCo2E: numeric("carbon_kg_co2e", { precision: 12, scale: 4 }),
    waterLiters: numeric("water_liters", { precision: 12, scale: 4 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_environment_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_environment_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_environment_unique").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_environment_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_environment_staging_product_id_staging_products",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_environment_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_environment_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_environment_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("staging_product_environment_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductEnvironmentRelations = relations(
  stagingProductEnvironment,
  ({ one }) => ({
    importJob: one(importJobs, {
      fields: [stagingProductEnvironment.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductEnvironment.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);

