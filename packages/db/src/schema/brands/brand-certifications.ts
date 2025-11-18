import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";
import { fileAssets } from "../data/file-assets";

export const brandCertifications = pgTable(
  "brand_certifications",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    certificationCode: text("certification_code"),
    instituteName: text("institute_name"),
    instituteAddress: text("institute_address"),
    instituteContact: text("institute_contact"),
    issueDate: timestamp("issue_date", { withTimezone: false, mode: "string" }),
    expiryDate: timestamp("expiry_date", {
      withTimezone: false,
      mode: "string",
    }),
    fileAssetId: uuid("file_asset_id").references(() => fileAssets.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    externalUrl: text("external_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    // RLS policies
    pgPolicy("brand_certifications_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_certifications_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_certifications_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_certifications_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
