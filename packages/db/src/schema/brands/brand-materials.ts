import { sql } from "drizzle-orm";
import {
  boolean,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { brandCertifications } from "./brand-certifications";

export const brandMaterials = pgTable(
  "brand_materials",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    certificationId: uuid("certification_id").references(
      () => brandCertifications.id,
      {
        onDelete: "set null",
        onUpdate: "cascade",
      },
    ),
    recyclable: boolean("recyclable"),
    countryOfOrigin: text("country_of_origin"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies
    pgPolicy("brand_materials_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_materials_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_materials_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_materials_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);
