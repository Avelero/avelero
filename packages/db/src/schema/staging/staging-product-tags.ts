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
import { brandTags } from "../brands/brand-tags";
import { importJobs } from "../data/import-jobs";
import { stagingProducts } from "./staging-products";

/**
 * Staging table for product tags.
 * Mirrors the production product_tags table structure.
 */
export const stagingProductTags = pgTable(
  "staging_product_tags",
  {
    stagingId: uuid("staging_id").defaultRandom().primaryKey().notNull(),
    stagingProductId: uuid("staging_product_id").notNull(),
    jobId: uuid("job_id").notNull(),
    tagId: uuid("tag_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("staging_product_tags_job_id_idx").using(
      "btree",
      table.jobId.asc().nullsLast().op("uuid_ops"),
    ),
    index("staging_product_tags_staging_product_id_idx").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
    ),
    uniqueIndex("staging_product_tags_unique").using(
      "btree",
      table.stagingProductId.asc().nullsLast().op("uuid_ops"),
      table.tagId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.tagId],
      foreignColumns: [brandTags.id],
      name: "staging_product_tags_tag_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("restrict"),
    foreignKey({
      columns: [table.stagingProductId],
      foreignColumns: [stagingProducts.stagingId],
      name: "staging_product_tags_staging_product_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.jobId],
      foreignColumns: [importJobs.id],
      name: "staging_product_tags_job_id_fk",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    pgPolicy("staging_product_tags_select_for_brand_members", {
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
    pgPolicy("staging_product_tags_insert_by_system", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_tags_update_by_system", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
    }),
    pgPolicy("staging_product_tags_delete_by_system", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
    }),
  ],
);

export const stagingProductTagsRelations = relations(
  stagingProductTags,
  ({ one }) => ({
    brandTag: one(brandTags, {
      fields: [stagingProductTags.tagId],
      references: [brandTags.id],
    }),
    importJob: one(importJobs, {
      fields: [stagingProductTags.jobId],
      references: [importJobs.id],
    }),
    stagingProduct: one(stagingProducts, {
      fields: [stagingProductTags.stagingProductId],
      references: [stagingProducts.stagingId],
    }),
  }),
);
