import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { primaryKey } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandTheme = pgTable(
  "brand_theme",
  {
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    themeStyles: jsonb("theme_styles").notNull().default({}),
    themeConfig: jsonb("theme_config").notNull().default({}),
    stylesheetPath: text("stylesheet_path"),
    googleFontsUrl: text("google_fonts_url"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.brandId], name: "brand_theme_brand_id_pkey" }),
    index("idx_brand_theme_updated_at").on(table.updatedAt),
    pgPolicy("brand_theme_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_theme_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_theme_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_theme_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
