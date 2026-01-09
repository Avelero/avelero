import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandEcoClaims } from "../catalog/brand-eco-claims";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant-level eco claim overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_eco_claims.
 * Mirrors the production variant_eco_claims table structure.
 */
export const stagingVariantEcoClaims = pgTable(
  "staging_variant_eco_claims",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    ecoClaimId: uuid("eco_claim_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_variant_eco_claims_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_variant_eco_claims_staging_variant_id_idx").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_variant_eco_claims_unique").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
      table.ecoClaimId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.ecoClaimId],
      foreignColumns: [brandEcoClaims.id],
      name: "staging_variant_eco_claims_eco_claim_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_eco_claims_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_eco_claims_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_eco_claims_select_for_brand_members", {
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
    pgPolicy("staging_variant_eco_claims_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_eco_claims_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_eco_claims_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantEcoClaimsRelations = relations(
  stagingVariantEcoClaims,
  ({ one }) => ({
    brandEcoClaim: one(brandEcoClaims, {
      fields: [stagingVariantEcoClaims.ecoClaimId],
      references: [brandEcoClaims.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingVariantEcoClaims.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantEcoClaims.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
