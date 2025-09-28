import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, timestamp, uuid, text, boolean, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { passportTemplates } from "./passport-templates";

export const passportTemplateModules = pgTable(
  "passport_template_modules",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    templateId: uuid("template_id")
      .references(() => passportTemplates.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    moduleKey: text("module_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    sortIndex: integer("sort_index").notNull(), 
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("passport_template_modules_template_module_unq").on(
      table.templateId,
      table.moduleKey,
    ),
    // RLS policies
    pgPolicy("passport_template_modules_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id))`,
    }),
    pgPolicy("passport_template_modules_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id))`,
    }),
    pgPolicy("passport_template_modules_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id))`,
    }),
    pgPolicy("passport_template_modules_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_member((SELECT brand_id FROM passport_templates WHERE id = template_id))`,
    }),
  ],
);
