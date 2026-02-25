import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { brands } from "../core/brands";

export const BRAND_QUALIFICATION_STATUSES = [
  "pending",
  "qualified",
  "rejected",
] as const;

export const BRAND_OPERATIONAL_STATUSES = ["active", "suspended"] as const;

export const BRAND_BILLING_STATUSES = [
  "unconfigured",
  "pending_payment",
  "active",
  "past_due",
  "canceled",
] as const;

export const BRAND_BILLING_MODES = [
  "standard_checkout",
  "enterprise_invoice",
] as const;

export const BRAND_BILLING_ACCESS_OVERRIDES = [
  "none",
  "temporary_allow",
  "temporary_block",
] as const;

export const BRAND_PLAN_TYPES = ["starter", "growth", "scale", "custom"] as const;

export const brandControl = pgTable(
  "brand_control",
  {
    brandId: uuid("brand_id")
      .primaryKey()
      .notNull()
      .references(() => brands.id, { onDelete: "cascade", onUpdate: "cascade" }),
    qualificationStatus: text("qualification_status")
      .notNull()
      .default("pending"),
    operationalStatus: text("operational_status").notNull().default("active"),
    billingStatus: text("billing_status").notNull().default("unconfigured"),
    billingMode: text("billing_mode"),
    billingAccessOverride: text("billing_access_override")
      .notNull()
      .default("none"),
    planType: text("plan_type"),
    planCurrency: text("plan_currency").notNull().default("EUR"),
    customMonthlyPriceCents: integer("custom_monthly_price_cents"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "brand_control_qualification_status_check",
      sql`qualification_status = ANY (ARRAY['pending'::text, 'qualified'::text, 'rejected'::text])`,
    ),
    check(
      "brand_control_operational_status_check",
      sql`operational_status = ANY (ARRAY['active'::text, 'suspended'::text])`,
    ),
    check(
      "brand_control_billing_status_check",
      sql`billing_status = ANY (ARRAY['unconfigured'::text, 'pending_payment'::text, 'active'::text, 'past_due'::text, 'canceled'::text])`,
    ),
    check(
      "brand_control_billing_mode_check",
      sql`billing_mode IS NULL OR billing_mode = ANY (ARRAY['standard_checkout'::text, 'enterprise_invoice'::text])`,
    ),
    check(
      "brand_control_billing_access_override_check",
      sql`billing_access_override = ANY (ARRAY['none'::text, 'temporary_allow'::text, 'temporary_block'::text])`,
    ),
    check(
      "brand_control_plan_type_check",
      sql`plan_type IS NULL OR plan_type = ANY (ARRAY['starter'::text, 'growth'::text, 'scale'::text, 'custom'::text])`,
    ),
    check(
      "brand_control_plan_currency_check",
      sql`char_length(plan_currency) = 3 AND plan_currency = upper(plan_currency)`,
    ),
    check(
      "brand_control_custom_monthly_price_positive_check",
      sql`custom_monthly_price_cents IS NULL OR custom_monthly_price_cents > 0`,
    ),
    check(
      "brand_control_custom_price_plan_consistency_check",
      sql`(
        (plan_type = 'custom' AND custom_monthly_price_cents IS NOT NULL)
        OR
        (COALESCE(plan_type, '') <> 'custom' AND custom_monthly_price_cents IS NULL)
      )`,
    ),
    index("idx_brand_control_qualification_status").using(
      "btree",
      table.qualificationStatus.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brand_control_billing_status").using(
      "btree",
      table.billingStatus.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brand_control_plan_type").using(
      "btree",
      table.planType.asc().nullsLast().op("text_ops"),
    ),
    index("idx_brand_control_admin_filters").using(
      "btree",
      table.qualificationStatus.asc().nullsLast().op("text_ops"),
      table.billingStatus.asc().nullsLast().op("text_ops"),
      table.operationalStatus.asc().nullsLast().op("text_ops"),
    ),
    pgPolicy("brand_control_select_by_service_role", {
      as: "permissive",
      for: "select",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("brand_control_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_control_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
    }),
    pgPolicy("brand_control_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);

