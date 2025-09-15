import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandFacilities = pgTable(
  "brand_facilities",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    displayName: text("display_name").notNull(),
    legalName: text("legal_name"),
    address: text("address"),
    city: text("city"),
    countryCode: text("country_code"),
    contact: text("contact"),
    vatNumber: text("vat_number"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies
    pgPolicy("brand_facilities_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_facilities_insert_by_brand_owner", {
      as: "permissive",
      for: "insert",
      to: ["authenticated"],
      withCheck: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_facilities_update_by_brand_owner", {
      as: "permissive",
      for: "update",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
    pgPolicy("brand_facilities_delete_by_brand_owner", {
      as: "permissive",
      for: "delete",
      to: ["authenticated"],
      using: sql`is_brand_owner(brand_id)`,
    }),
  ],
);
