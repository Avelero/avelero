import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  pgPolicy,
  index
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const passportTemplates = pgTable(
  "passport_templates",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),

    // Template data
    name: text("name").notNull(),
    theme: jsonb("theme").default({}).notNull(),

    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // Performance indexes for brand-scoped queries
    brandNameIdx: index("passport_templates_brand_name_idx").on(table.brandId, table.name),
    brandCreatedIdx: index("passport_templates_brand_created_idx").on(table.brandId, table.createdAt),

    // RLS policies for brand isolation
    passportTemplatesSelectForBrandMembers: pgPolicy("passport_templates_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    passportTemplatesInsertByBrandOwner: pgPolicy("passport_templates_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    passportTemplatesUpdateByBrandOwner: pgPolicy("passport_templates_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    passportTemplatesDeleteByBrandOwner: pgPolicy("passport_templates_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
  }),
);

export type PassportTemplate = typeof passportTemplates.$inferSelect;
export type NewPassportTemplate = typeof passportTemplates.$inferInsert;