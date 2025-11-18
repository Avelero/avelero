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
import { importJobs } from "../data/import-jobs";
import { productVariants } from "../products/product-variants";
import { stagingProducts } from "./staging-products";

export const stagingProductVariants = pgTable(
  "staging_product_variants",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    action: text("action").notNull(),
    existingVariantId: uuid("existing_variant_id"),
    id: uuid("id").notNull(),
    productId: uuid("product_id").notNull(),
    colorId: uuid("color_id"),
    sizeId: uuid("size_id"),
    upid: text("upid").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_variants_action_idx").using(
      "btree",
      table.action.asc().nullsLast().op("text_ops"),
    ),
    index("staging_product_variants_existing_variant_id_idx").using(
      "btree",
      table.existingVariantId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_variants_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_variants_job_row_unq").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
      table.rowNumber.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_variants_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_variants_upid_idx").using(
      "btree",
      table.upid.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.existingVariantId],
      foreignColumns: [productVariants.id],
      name: "staging_product_variants_existing_variant_id_product_variants_i",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_variants_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_variants_staging_product_id_staging_products_st",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_variants_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`(EXISTS ( SELECT 1
   FROM import_jobs
  WHERE ((import_jobs.id = staging_product_variants.job_id) AND is_brand_member(import_jobs.brand_id))))`,
    }),
    pgPolicy("staging_product_variants_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_variants_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
    }),
    pgPolicy("staging_product_variants_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductVariantsRelations = relations(
  stagingProductVariants,
  ({ one, many }) => ({
    productVariant: one(productVariants, {
      fields: [stagingProductVariants.existingVariantId],
      references: [productVariants.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProductVariants.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductVariants.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);

