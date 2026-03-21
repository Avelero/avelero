/**
 * Live Stripe tests for enterprise invoice lifecycle handling.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import {
  createClockCustomer,
  createLiveBillingBrand,
  createLiveEnterpriseInvoice,
} from "./helpers/live-billing";
import {
  createLiveStripeCleanupTracker,
  createStripeTestClock,
  ensureLiveStripePriceCatalog,
  getLiveStripeClient,
  readLiveBrandBillingState,
  waitForBillingEvent,
  waitForCondition,
  waitForInvoiceProjection,
} from "./helpers/live-billing";

/**
 * Provisions a live enterprise billing customer on a test clock.
 */
async function provisionEnterpriseInvoiceBrand(namePrefix: string) {
  const stripe = getLiveStripeClient();
  const cleanup = createLiveStripeCleanupTracker(stripe);
  const harness = await createLiveBillingBrand({
    namePrefix,
    phase: "demo",
  });
  const clock = await createStripeTestClock({
    stripe,
    name: `${harness.brandId}-enterprise`,
  });
  cleanup.trackClock(clock.id);

  const { customer } = await createClockCustomer({
    stripe,
    clockId: clock.id,
    brandId: harness.brandId,
    email: harness.ownerEmail,
    name: harness.brandName,
    testRunId: harness.brandId,
    scenario: namePrefix,
    cardNumber: "4242424242424242",
  });
  cleanup.trackCustomer(customer.id);

  return {
    stripe,
    cleanup,
    harness,
    clock,
    customer,
  };
}

beforeAll(async () => {
  // Validate the sandbox price catalog before invoice lifecycle tests run.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe enterprise invoices", () => {
  it("projects a sent invoice and activates the brand after the real invoice is paid", async () => {
    const provisioned =
      await provisionEnterpriseInvoiceBrand("Enterprise Invoice Paid");

    try {
      const servicePeriodStart = "2026-02-01T00:00:00.000Z";
      const servicePeriodEnd = "2027-02-01T00:00:00.000Z";

      const invoice = await createLiveEnterpriseInvoice({
        brandId: provisioned.harness.brandId,
        stripeCustomerId: provisioned.customer.id,
        amountCents: 250000,
        description: "Enterprise annual billing",
        recipientName: provisioned.harness.brandName,
        recipientEmail: provisioned.harness.ownerEmail,
        servicePeriodStart,
        servicePeriodEnd,
        daysUntilDue: 7,
        internalReference: provisioned.harness.brandId,
      });

      const openProjection = await waitForInvoiceProjection({
        brandId: provisioned.harness.brandId,
        invoiceId: invoice.invoiceId,
      });

      expect(openProjection.collectionMethod).toBe("send_invoice");
      expect(openProjection.hostedInvoiceUrl).toBeTruthy();

      await provisioned.stripe.invoices.pay(invoice.invoiceId);

      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "invoice_paid",
      });

      const paidProjection = await waitForInvoiceProjection({
        brandId: provisioned.harness.brandId,
        invoiceId: invoice.invoiceId,
        status: "paid",
      });

      expect(paidProjection.amountPaid).toBe(250000);

      const activeState = await waitForCondition({
        description: `enterprise activation for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.lifecycle?.phase === "active" &&
          state.plan?.planType === "enterprise" &&
          state.billing?.billingMode === "stripe_invoice",
      });

      expect(activeState.billing?.currentPeriodStart).toBe(servicePeriodStart);
      expect(activeState.billing?.currentPeriodEnd).toBe(servicePeriodEnd);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("projects marked uncollectible enterprise invoices", async () => {
    const provisioned =
      await provisionEnterpriseInvoiceBrand("Enterprise Invoice Uncollectible");

    try {
      const invoice = await createLiveEnterpriseInvoice({
        brandId: provisioned.harness.brandId,
        stripeCustomerId: provisioned.customer.id,
        amountCents: 125000,
        description: "Enterprise invoice to mark uncollectible",
        recipientName: provisioned.harness.brandName,
        recipientEmail: provisioned.harness.ownerEmail,
        servicePeriodStart: "2026-03-01T00:00:00.000Z",
        servicePeriodEnd: "2027-03-01T00:00:00.000Z",
        daysUntilDue: 7,
      });

      await provisioned.stripe.invoices.markUncollectible(invoice.invoiceId);

      const projection = await waitForInvoiceProjection({
        brandId: provisioned.harness.brandId,
        invoiceId: invoice.invoiceId,
        status: "uncollectible",
      });

      expect(projection.status).toBe("uncollectible");
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("projects voided enterprise invoices", async () => {
    const provisioned =
      await provisionEnterpriseInvoiceBrand("Enterprise Invoice Voided");

    try {
      const invoice = await createLiveEnterpriseInvoice({
        brandId: provisioned.harness.brandId,
        stripeCustomerId: provisioned.customer.id,
        amountCents: 95000,
        description: "Enterprise invoice to void",
        recipientName: provisioned.harness.brandName,
        recipientEmail: provisioned.harness.ownerEmail,
        servicePeriodStart: "2026-04-01T00:00:00.000Z",
        servicePeriodEnd: "2027-04-01T00:00:00.000Z",
        daysUntilDue: 7,
      });

      await provisioned.stripe.invoices.voidInvoice(invoice.invoiceId);

      const projection = await waitForInvoiceProjection({
        brandId: provisioned.harness.brandId,
        invoiceId: invoice.invoiceId,
        status: "void",
      });

      expect(projection.status).toBe("void");
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
