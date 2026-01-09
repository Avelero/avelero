import { relations, sql } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  pgPolicy,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brandAttributes } from "../catalog/brand-attributes";
import { brandAttributeValues } from "../catalog/brand-attribute-values";
import { importJobs } from "../data/import-jobs";
import { stagingProductVariants } from "./staging-product-variants";

/**
 * Staging table for variant attributes (generalizable attribute system).
 * Replaces the legacy fixed color_id/size_id columns with flexible attribute/value pairs.
 * Mirrors the production product_variant_attributes table structure.
 */
export const stagingVariantAttributes = pgTable(
  "staging_variant_attributes",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingVariantId: uuid("staging_variant_id").notNull(),
    jobId: uuid("job_id").notNull(),
    attributeId: uuid("attribute_id").notNull(),
    attributeValueId: uuid("attribute_value_id").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_variant_attributes_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_variant_attributes_staging_variant_id_idx").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_variant_attributes_unique").using(
      "btree",
      table.stagingVariantId.asc().nullsLast().op("uuid_ops"),
      table.attributeId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.attributeId],
      foreignColumns: [brandAttributes.id],
      name: "staging_variant_attributes_attribute_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.attributeValueId],
      foreignColumns: [brandAttributeValues.id],
      name: "staging_variant_attributes_attribute_value_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.stagingVariantId],
      foreignColumns: [stagingProductVariants.stagingId],
      name: "staging_variant_attributes_staging_variant_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_variant_attributes_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_variant_attributes_select_for_brand_members", {
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
    pgPolicy("staging_variant_attributes_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_attributes_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_variant_attributes_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingVariantAttributesRelations = relations(
  stagingVariantAttributes,
  ({ one }) => ({
    brandAttribute: one(brandAttributes, {
      fields: [stagingVariantAttributes.attributeId],
      references: [brandAttributes.id],
    }),
    brandAttributeValue: one(brandAttributeValues, {
      fields: [stagingVariantAttributes.attributeValueId],
      references: [brandAttributeValues.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingVariantAttributes.jobId],
      references: [importJobs.id],
    }),
    stagingVariant: one(stagingProductVariants, {
      fields: [stagingVariantAttributes.stagingVariantId],
      references: [stagingProductVariants.stagingId],
    }),
  }),
);
