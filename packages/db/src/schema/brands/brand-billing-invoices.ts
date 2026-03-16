/**
 * Stores the local Stripe invoice projection used for admin visibility and entitlement sync.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
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

export const brandBillingInvoices = pgTable(
  "brand_billing_invoices",
  {
    id: uuid("id").defaultRandom().primaryKey().notNull(),
    brandId: uuid("brand_id")
      .references(() => brands.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      })
      .notNull(),
    stripeInvoiceId: text("stripe_invoice_id").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    status: text("status").notNull(),
    collectionMethod: text("collection_method"),
    currency: text("currency").notNull().default("eur"),
    amountDue: integer("amount_due").notNull().default(0),
    amountPaid: integer("amount_paid").notNull().default(0),
    amountRemaining: integer("amount_remaining").notNull().default(0),
    subtotal: integer("subtotal"),
    total: integer("total"),
    dueDate: timestamp("due_date", {
      withTimezone: true,
      mode: "string",
    }),
    paidAt: timestamp("paid_at", {
      withTimezone: true,
      mode: "string",
    }),
    voidedAt: timestamp("voided_at", {
      withTimezone: true,
      mode: "string",
    }),
    hostedInvoiceUrl: text("hosted_invoice_url"),
    invoicePdfUrl: text("invoice_pdf_url"),
    invoiceNumber: text("invoice_number"),
    servicePeriodStart: timestamp("service_period_start", {
      withTimezone: true,
      mode: "string",
    }),
    servicePeriodEnd: timestamp("service_period_end", {
      withTimezone: true,
      mode: "string",
    }),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    recipientTaxId: text("recipient_tax_id"),
    recipientAddressLine1: text("recipient_address_line_1"),
    recipientAddressLine2: text("recipient_address_line_2"),
    recipientAddressCity: text("recipient_address_city"),
    recipientAddressRegion: text("recipient_address_region"),
    recipientAddressPostalCode: text("recipient_address_postal_code"),
    recipientAddressCountry: text("recipient_address_country"),
    description: text("description"),
    footer: text("footer"),
    internalReference: text("internal_reference"),
    managedByAvelero: boolean("managed_by_avelero").notNull().default(false),
    lastSyncedFromStripeAt: timestamp("last_synced_from_stripe_at", {
      withTimezone: true,
      mode: "string",
    }),
    lastStripeEventId: text("last_stripe_event_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    check(
      "brand_billing_invoices_status_check",
      sql`status = ANY (ARRAY['draft'::text, 'open'::text, 'paid'::text, 'uncollectible'::text, 'void'::text])`,
    ),
    check(
      "brand_billing_invoices_collection_method_check",
      sql`collection_method IS NULL OR collection_method = ANY (ARRAY['charge_automatically'::text, 'send_invoice'::text])`,
    ),
    check(
      "brand_billing_invoices_currency_check",
      sql`char_length(currency) = 3`,
    ),
    check(
      "brand_billing_invoices_amount_due_check",
      sql`amount_due >= 0`,
    ),
    check(
      "brand_billing_invoices_amount_paid_check",
      sql`amount_paid >= 0`,
    ),
    check(
      "brand_billing_invoices_amount_remaining_check",
      sql`amount_remaining >= 0`,
    ),
    check(
      "brand_billing_invoices_service_period_check",
      sql`service_period_end IS NULL OR service_period_start IS NULL OR service_period_end >= service_period_start`,
    ),
    uniqueIndex("brand_billing_invoices_stripe_invoice_id_unq").on(
      table.stripeInvoiceId,
    ),
    index("idx_brand_billing_invoices_brand_created_at").on(
      table.brandId,
      table.createdAt,
    ),
    index("idx_brand_billing_invoices_brand_status").on(
      table.brandId,
      table.status,
    ),
    index("idx_brand_billing_invoices_due_date").on(table.dueDate),
    pgPolicy("brand_billing_invoices_select_for_brand_members", {
      as: "permissive",
      for: "select",
      to: ["authenticated", "service_role"],
      using: sql`is_brand_member(brand_id)`,
    }),
    pgPolicy("brand_billing_invoices_insert_by_service_role", {
      as: "permissive",
      for: "insert",
      to: ["service_role"],
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_invoices_update_by_service_role", {
      as: "permissive",
      for: "update",
      to: ["service_role"],
      using: sql`true`,
      withCheck: sql`true`,
    }),
    pgPolicy("brand_billing_invoices_delete_by_service_role", {
      as: "permissive",
      for: "delete",
      to: ["service_role"],
      using: sql`true`,
    }),
  ],
);
