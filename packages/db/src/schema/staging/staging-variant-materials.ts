import { relations, sql } from "drizzle-orm";
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
import { brandMaterials } from "../catalog/brand-materials";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant-level material overrides.
 * When ANY rows exist for a variant, they replace (not merge with) product_materials.
 * Mirrors the production variant_materials table structure.
 */
export const stagingVariantMaterials = pgTable(
  "staging_variant_materials",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    brandMaterialId: uuid("brand_material_id").notNull(),
    percentage: numeric("percentage", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_variant_materials_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_variant_materials_staging_variant_id_idx").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_variant_materials_unique").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
      table.brandMaterialId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandMaterialId],
      foreignColumns: [brandMaterials.id],
      name: "staging_variant_materials_brand_material_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_materials_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_materials_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_materials_select_for_brand_members", {
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
    pgPolicy("staging_variant_materials_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_materials_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_materials_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantMaterialsRelations = relations(
  stagingVariantMaterials,
  ({ one }) => ({
    brandMaterial: one(brandMaterials, {
      fields: [stagingVariantMaterials.brandMaterialId],
      references: [brandMaterials.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingVariantMaterials.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantMaterials.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
