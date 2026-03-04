import { sql } from "drizzle-orm";
import {
  check,
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

export const brandBilling = pgTable(
  "brand_billing",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    billingMode: text("billing_mode"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    planCurrency: text("plan_currency").notNull().default("EUR"),
    customMonthlyPriceCents: integer("custom_monthly_price_cents"),
    billingAccessOverride: text("billing_access_override")
      .notNull()
      .default("none"),
    billingOverrideExpiresAt: timestamp("billing_override_expires_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "brand_billing_mode_check",
      sql`billing_mode IS NULL OR billing_mode = ANY (ARRAY['stripe_checkout'::text, 'stripe_invoice'::text])`,
    ),
    check("brand_billing_plan_currency_check", sql`char_length(plan_currency) = 3`),
    check(
      "brand_billing_custom_monthly_price_check",
      sql`custom_monthly_price_cents IS NULL OR custom_monthly_price_cents >= 0`,
    ),
    check(
      "brand_billing_access_override_check",
      sql`billing_access_override = ANY (ARRAY['none'::text, 'temporary_allow'::text, 'temporary_block'::text])`,
    ),
    uniqueIndex("brand_billing_brand_id_unq").on(table.brandId),
    uniqueIndex("brand_billing_stripe_customer_id_unq")
      .on(table.stripeCustomerId)
      .where(sql`(stripe_customer_id IS NOT NULL)`),
    uniqueIndex("brand_billing_stripe_subscription_id_unq")
      .on(table.stripeSubscriptionId)
      .where(sql`(stripe_subscription_id IS NOT NULL)`),
    index("idx_brand_billing_override_expires").on(table.billingOverrideExpiresAt),
    pgPolicy("brand_billing_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_billing_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
