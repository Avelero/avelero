import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const brandPlan = pgTable(
  "brand_plan",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    planType: text("plan_type"),
    planSelectedAt: timestamp("plan_selected_at", {
      withTimezone: true,
      mode: "string",
    }),
    skuAnnualLimit: integer("sku_annual_limit"),
    skuOnboardingLimit: integer("sku_onboarding_limit"),
    skuLimitOverride: integer("sku_limit_override"),
    skuYearStart: date("sku_year_start", { mode: "date" }),
    skusCreatedThisYear: integer("skus_created_this_year").notNull().default(0),
    skusCreatedOnboarding: integer("skus_created_onboarding")
      .notNull()
      .default(0),
    maxSeats: integer("max_seats"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "brand_plan_type_check",
      sql`plan_type IS NULL OR plan_type = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'enterprise'::text])`,
    ),
    check(
      "brand_plan_sku_annual_limit_check",
      sql`sku_annual_limit IS NULL OR sku_annual_limit >= 0`,
    ),
    check(
      "brand_plan_sku_onboarding_limit_check",
      sql`sku_onboarding_limit IS NULL OR sku_onboarding_limit >= 0`,
    ),
    check(
      "brand_plan_sku_limit_override_check",
      sql`sku_limit_override IS NULL OR sku_limit_override >= 0`,
    ),
    check(
      "brand_plan_skus_created_this_year_check",
      sql`skus_created_this_year >= 0`,
    ),
    check(
      "brand_plan_skus_created_onboarding_check",
      sql`skus_created_onboarding >= 0`,
    ),
    check("brand_plan_max_seats_check", sql`max_seats IS NULL OR max_seats > 0`),
    uniqueIndex("brand_plan_brand_id_unq").on(table.brandId),
    index("idx_brand_plan_plan_type").on(table.planType),
    index("idx_brand_plan_sku_year_start").on(table.skuYearStart),
    pgPolicy("brand_plan_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_plan_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_plan_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("brand_plan_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
