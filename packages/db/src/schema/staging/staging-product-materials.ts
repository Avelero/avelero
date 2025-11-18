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
import { brandMaterials } from "../brands/brand-materials";
import { stagingProducts } from "./staging-products";

export const stagingProductMaterials = pgTable(
  "staging_product_materials",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    brandMaterialId: uuid("brand_material_id").notNull(),
    percentage: numeric("percentage", { precision: 6, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_materials_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_materials_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_materials_unique").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
      table.brandMaterialId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.brandMaterialId],
      foreignColumns: [brandMaterials.id],
      name: "staging_product_materials_brand_material_id_brand_materials_id_",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_materials_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_materials_staging_product_id_staging_products_s",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_materials_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_materials_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("staging_product_materials_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductMaterialsRelations = relations(
  stagingProductMaterials,
  ({ one }) => ({
    brandMaterial: one(brandMaterials, {
      fields: [stagingProductMaterials.brandMaterialId],
      references: [brandMaterials.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProductMaterials.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductMaterials.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);

