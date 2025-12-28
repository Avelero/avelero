import { sql } from "drizzle-orm";
import { pgPolicy, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { uniqueIndex } from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandEcoClaims = pgTable(
  "brand_eco_claims",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" })
      .notNull(),
    claim: text("claim").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("brand_eco_claims_brand_claim_unq").on(
      table.brandId,
      table.claim,
    ),
    // RLS policies
    pgPolicy("brand_eco_claims_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_eco_claims_insert_by_brand_member", {
      as: "permissive",
      for: "insert",
      to: ["authenticated", "service_role"],
      withCheck: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_eco_claims_update_by_brand_member", {
      as: "permissive",
      for: "update",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_eco_claims_delete_by_brand_member", {
      as: "permissive",
      for: "delete",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
  ],
);
