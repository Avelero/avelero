import { relations } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { importJobs } from "../data/import-jobs";
import { brandEcoClaims } from "../brands/brand-eco-claims";
import { stagingProducts } from "./staging-products";

export const stagingProductEcoClaims = pgTable(
  "staging_product_eco_claims",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    ecoClaimId: uuid("eco_claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_eco_claims_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_eco_claims_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_eco_claims_unique").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
      table.ecoClaimId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.ecoClaimId],
      foreignColumns: [brandEcoClaims.id],
      name: "staging_product_eco_claims_eco_claim_id_brand_eco_claims_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_eco_claims_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_eco_claims_staging_product_id_staging_products_",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_eco_claims_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_eco_claims_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("staging_product_eco_claims_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductEcoClaimsRelations = relations(
  stagingProductEcoClaims,
  ({ one }) => ({
    brandEcoClaim: one(brandEcoClaims, {
      fields: [stagingProductEcoClaims.ecoClaimId],
      references: [brandEcoClaims.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProductEcoClaims.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductEcoClaims.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);

