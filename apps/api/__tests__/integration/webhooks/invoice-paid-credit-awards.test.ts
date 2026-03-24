/**
 * Integration tests for invoice.paid credit-award behavior.
 *
 * Calls handleInvoicePaid directly with testDb to avoid the
 * transaction-within-transaction deadlock that verifyAndDispatch causes
 * (it opens its own db.transaction which conflicts with the per-test
 * transaction from setup.ts).
 */
import "../../setup";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { createTestBrand, testDb } from "@v1/db/testing";
import { setBrandSubscriptionState } from "../../helpers/billing";

let projectedPlanType: "starter" | "growth" | "scale" = "starter";
let projectedBillingInterval: "quarterly" | "yearly" = "quarterly";

const mockResolveBrandIdForInvoice = mock(
  async ({ invoice }: { invoice: { metadata?: Record<string, string> } }) =>
    invoice.metadata?.brand_id ?? null,
);
const mockSyncStripeSubscriptionProjectionById = mock(
  async ({ brandId }: { brandId?: string | null }) => ({
    brandId: brandId ?? null,
    projection: {
      planType: projectedPlanType,
      billingInterval: projectedBillingInterval,
    },
  }),
);
const mockUpsertStripeInvoiceProjection = mock(
  async ({ knownBrandId }: { knownBrandId?: string | null }) => ({
    brandId: knownBrandId ?? null,
    managedByAvelero: false,
    servicePeriodStart: null,
    servicePeriodEnd: null,
  }),
);
const mockAwardCredits = mock(
  async ({
    db,
    brandId,
    credits,
  }: {
    db: typeof testDb;
    brandId: string;
    credits: number;
  }) => {
    const [updated] = await db
      .update(schema.brandPlan)
      .set({
        totalCredits: (await getBrandPlanState(brandId)).totalCredits + credits,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.brandPlan.brandId, brandId))
      .returning({
        totalCredits: schema.brandPlan.totalCredits,
      });

    return updated?.totalCredits ?? credits;
  },
);

mock.module("../../../src/lib/stripe/projection.js", () => ({
  applyEnterpriseInvoiceEntitlement: mock(async () => {}),
  awardCredits: mockAwardCredits,
  getInvoiceSubscriptionId: (invoice: { subscription?: string | { id: string } | null }) =>
    typeof invoice.subscription === "string"
      ? invoice.subscription
      : invoice.subscription?.id ?? null,
  getStripeId: (value: string | { id: string } | null | undefined) =>
    typeof value === "string" ? value : value?.id ?? null,
  resolveBrandIdForInvoice: mockResolveBrandIdForInvoice,
  syncStripeSubscriptionProjectionById: mockSyncStripeSubscriptionProjectionById,
  upsertStripeInvoiceProjection: mockUpsertStripeInvoiceProjection,
}));

const { handleInvoicePaid } = await import(
  "../../../src/lib/stripe/handlers/invoice-paid"
);

/**
 * Builds a minimal Stripe invoice.paid event object for handler tests.
 */
function buildInvoicePaidEvent(params: {
  brandId: string;
  eventId?: string;
  invoiceId?: string;
  subscriptionId?: string;
  amountPaid?: number;
  billingReason?: string;
}) {
  return {
    id: params.eventId ?? `evt_${crypto.randomUUID()}`,
    object: "event" as const,
    api_version: "2026-01-28.clover",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: "invoice.paid" as const,
    data: {
      object: {
        id: params.invoiceId ?? `in_${crypto.randomUUID()}`,
        object: "invoice" as const,
        status: "paid" as const,
        metadata: { brand_id: params.brandId },
        customer: `cus_${crypto.randomUUID().slice(0, 8)}`,
        subscription:
          params.subscriptionId ?? `sub_${crypto.randomUUID().slice(0, 8)}`,
        billing_reason: params.billingReason ?? "subscription_create",
        amount_paid: params.amountPaid ?? 75_000,
      },
    },
  };
}

/**
 * Loads the current credit state for the tested brand.
 */
async function getBrandPlanState(brandId: string) {
  const [plan] = await testDb
    .select({
      totalCredits: schema.brandPlan.totalCredits,
      onboardingDiscountUsed: schema.brandPlan.onboardingDiscountUsed,
    })
    .from(schema.brandPlan)
    .where(eq(schema.brandPlan.brandId, brandId))
    .limit(1);

  if (!plan) {
    throw new Error(`Missing brand plan for ${brandId}`);
  }

  return plan;
}

/**
 * Reads the latest invoice-paid billing event emitted for the brand.
 */
async function getLatestInvoicePaidEvent(brandId: string) {
  const [billingEvent] = await testDb
    .select({
      stripeEventId: schema.brandBillingEvents.stripeEventId,
      payload: schema.brandBillingEvents.payload,
    })
    .from(schema.brandBillingEvents)
    .where(eq(schema.brandBillingEvents.brandId, brandId))
    .limit(1);

  return billingEvent ?? null;
}

describe("invoice.paid credit awards", () => {
  beforeEach(() => {
    mockResolveBrandIdForInvoice.mockClear();
    mockSyncStripeSubscriptionProjectionById.mockClear();
    mockUpsertStripeInvoiceProjection.mockClear();
    mockAwardCredits.mockClear();
    projectedPlanType = "starter";
    projectedBillingInterval = "quarterly";
  });

  it("awards the quarterly credit grant for subscription_create invoices", async () => {
    const brandId = await createTestBrand("Invoice Paid Quarterly Credit Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "past_due",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_invoice_paid_quarterly",
      stripeSubscriptionId: "sub_invoice_paid_quarterly",
      totalCredits: 50,
    });

    await handleInvoicePaid(buildInvoicePaidEvent({ brandId }) as any, testDb);

    expect(await getBrandPlanState(brandId)).toMatchObject({
      totalCredits: 450,
    });
    expect((await getLatestInvoicePaidEvent(brandId))?.payload).toMatchObject({
      credits_awarded: 400,
      total_credits: 450,
      billing_reason: "subscription_create",
    });
  });

  it("awards the yearly credit grant upfront for subscription_cycle invoices", async () => {
    const brandId = await createTestBrand("Invoice Paid Yearly Credit Brand");
    projectedPlanType = "growth";
    projectedBillingInterval = "yearly";

    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "yearly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_invoice_paid_yearly",
      stripeSubscriptionId: "sub_invoice_paid_yearly",
      totalCredits: 50,
    });

    await handleInvoicePaid(
      buildInvoicePaidEvent({
        brandId,
        billingReason: "subscription_cycle",
        amountPaid: 662_400,
      }) as any,
      testDb,
    );

    expect(await getBrandPlanState(brandId)).toMatchObject({
      totalCredits: 4_850,
    });
    expect((await getLatestInvoicePaidEvent(brandId))?.payload).toMatchObject({
      credits_awarded: 4_800,
      total_credits: 4_850,
      billing_reason: "subscription_cycle",
    });
  });

  it("does not award credits for zero-amount invoices", async () => {
    const brandId = await createTestBrand("Invoice Paid Zero Amount Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_invoice_paid_zero",
      stripeSubscriptionId: "sub_invoice_paid_zero",
      totalCredits: 50,
    });

    await handleInvoicePaid(
      buildInvoicePaidEvent({ brandId, amountPaid: 0 }) as any,
      testDb,
    );

    expect(await getBrandPlanState(brandId)).toMatchObject({
      totalCredits: 50,
    });
    expect((await getLatestInvoicePaidEvent(brandId))?.payload).toMatchObject({
      credits_awarded: 0,
      total_credits: null,
    });
  });

  it("does not award credits for non-crediting billing reasons", async () => {
    const brandId = await createTestBrand("Invoice Paid Non-crediting Reason Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_invoice_paid_non_crediting",
      stripeSubscriptionId: "sub_invoice_paid_non_crediting",
      totalCredits: 50,
    });

    await handleInvoicePaid(
      buildInvoicePaidEvent({
        brandId,
        billingReason: "subscription_update",
      }) as any,
      testDb,
    );

    expect(await getBrandPlanState(brandId)).toMatchObject({
      totalCredits: 50,
    });
    expect((await getLatestInvoicePaidEvent(brandId))?.payload).toMatchObject({
      credits_awarded: 0,
      total_credits: null,
      billing_reason: "subscription_update",
    });
  });

  // NOTE: Idempotency (duplicate event protection) is handled by verifyAndDispatch
  // via the stripe_webhook_events table, not by handleInvoicePaid itself.
  // That behavior is covered in the stripe-webhook integration tests.
});
