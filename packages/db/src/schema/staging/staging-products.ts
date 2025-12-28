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
import { products } from "../products/products";
import { stagingProductEcoClaims } from "./staging-eco-claims";
import { stagingProductEnvironment } from "./staging-product-environment";
import { stagingProductJourneySteps } from "./staging-product-journey-steps";
import { stagingProductMaterials } from "./staging-product-materials";
import { stagingProductVariants } from "./staging-product-variants";

export const stagingProducts = pgTable(
  "staging_products",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    jobId: uuid("job_id").notNull(),
    rowNumber: integer("row_number").notNull(),
    action: text("action").notNull(),
    existingProductId: uuid("existing_product_id"),
    id: uuid("id").notNull(),
    brandId: uuid("brand_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    manufacturerId: uuid("manufacturer_id"),
    imagePath: text("image_path"),
    categoryId: uuid("category_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    seasonId: uuid("season_id"),
    /** URL-friendly product handle for DPP URLs */
    productHandle: text("product_handle"),
    /** Internal 16-character UPID (legacy, still stored in products table) */
    productUpid: text("product_upid"),
    status: text("status"),
  },
  (table) => [
    index("staging_products_action_idx").using(
      "btree",
      table.action.asc().nullsLast().op("text_ops"),
    ),
    index("staging_products_brand_id_idx").using(
      "btree",
      table.brandId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_products_existing_product_id_idx").using(
      "btree",
      table.existingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_products_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_products_job_row_unq").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
      table.rowNumber.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.existingProductId],
      foreignColumns: [products.id],
      name: "staging_products_existing_product_id_products_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_products_job_id_import_jobs_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_products_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`(EXISTS ( SELECT 1
   FROM import_jobs
  WHERE ((import_jobs.id = staging_products.job_id) AND is_brand_member(import_jobs.brand_id))))`,
    }),
    pgPolicy("staging_products_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_products_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("staging_products_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductsRelations = relations(
  stagingProducts,
  ({ one, many }) => ({
    product: one(products, {
      fields: [stagingProducts.existingProductId],
      references: [products.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProducts.jobId],
      references: [importJobs.id],
    }),
    stagingProductVariants: many(stagingProductVariants),
    stagingProductEnvironments: many(stagingProductEnvironment),
    stagingProductJourneySteps: many(stagingProductJourneySteps),
    stagingProductEcoClaims: many(stagingProductEcoClaims),
    stagingProductMaterials: many(stagingProductMaterials),
  }),
);
