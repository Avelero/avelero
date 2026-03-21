/**
 * Live Stripe tests for renewal failures, recovery, and cancellation lifecycle flow.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { attachCustomerCardPaymentMethod } from "./helpers/live-billing";
import {
  advanceStripeTestClock,
  ensureLiveStripePriceCatalog,
  provisionActiveStripeBillingBrand,
  readLiveBrandBillingState,
  waitForBillingEvent,
  waitForBrandPhase,
  waitForCondition,
} from "./helpers/live-billing";

/**
 * Lists the current Stripe invoices for a subscription in newest-first order.
 */
async function listSubscriptionInvoices(params: {
  stripe: Awaited<ReturnType<typeof provisionActiveStripeBillingBrand>>["stripe"];
  subscriptionId: string;
}) {
  const invoices = await params.stripe.invoices.list({
    subscription: params.subscriptionId,
    limit: 10,
  });

  return invoices.data;
}

beforeAll(async () => {
  // Validate the live price catalog once before lifecycle tests run.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe subscription lifecycle", () => {
  it("transitions to past_due on renewal failure and recovers after paying the real invoice", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Lifecycle Recovery",
      tier: "starter",
      interval: "monthly",
      includeImpact: false,
    });

    try {
      const initialInvoices = await listSubscriptionInvoices({
        stripe: provisioned.stripe,
        subscriptionId: provisioned.subscription.id,
      });
      const initialInvoiceIds = new Set(initialInvoices.map((invoice) => invoice.id));

      await attachCustomerCardPaymentMethod({
        stripe: provisioned.stripe,
        customerId: provisioned.customer.id,
        cardNumber: "4000000000000341",
      });

      const activeState = await readLiveBrandBillingState(
        provisioned.harness.brandId,
      );
      const currentPeriodEnd = activeState.billing?.currentPeriodEnd;
      expect(currentPeriodEnd).toBeTruthy();

      await advanceStripeTestClock({
        stripe: provisioned.stripe,
        clockId: provisioned.clock.id,
        frozenTime: new Date(
          new Date(currentPeriodEnd!).getTime() + 60 * 60 * 1000,
        ),
      });

      await waitForBrandPhase(provisioned.harness.brandId, "past_due");
      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "invoice_payment_failed",
      });

      const failedState = await waitForCondition({
        description: `past due billing projection for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) => !!state.billing?.pastDueSince,
      });
      expect(failedState.billing?.pastDueSince).toBeTruthy();

      const invoicesAfterFailure = await listSubscriptionInvoices({
        stripe: provisioned.stripe,
        subscriptionId: provisioned.subscription.id,
      });
      const failedInvoice = invoicesAfterFailure.find(
        (invoice) =>
          !initialInvoiceIds.has(invoice.id) &&
          invoice.billing_reason === "subscription_cycle",
      );

      expect(failedInvoice).toBeDefined();
      expect(failedInvoice?.status).toBe("open");

      await attachCustomerCardPaymentMethod({
        stripe: provisioned.stripe,
        customerId: provisioned.customer.id,
        cardNumber: "4242424242424242",
      });
      await provisioned.stripe.invoices.pay(failedInvoice!.id);

      await waitForBrandPhase(provisioned.harness.brandId, "active");
      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "invoice_paid",
      });

      const recoveredState = await waitForCondition({
        description: `recovered billing projection for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) => state.billing?.pastDueSince === null,
      });

      expect(recoveredState.billing?.pastDueSince).toBeNull();
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("preserves access until period end and then marks the brand cancelled", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Lifecycle Cancellation",
      tier: "starter",
      interval: "monthly",
      includeImpact: false,
    });

    try {
      const activeState = await readLiveBrandBillingState(
        provisioned.harness.brandId,
      );
      const currentPeriodEnd = activeState.billing?.currentPeriodEnd;
      expect(currentPeriodEnd).toBeTruthy();

      await provisioned.stripe.subscriptions.update(provisioned.subscription.id, {
        cancel_at_period_end: true,
      });

      const pendingState = await waitForCondition({
        description: `pending cancellation projection for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) => state.billing?.pendingCancellation === true,
      });

      expect(pendingState.lifecycle?.phase).toBe("active");

      const status =
        await provisioned.harness.caller.brand.billing.getStatus();
      expect(status.pending_cancellation).toBe(true);

      await advanceStripeTestClock({
        stripe: provisioned.stripe,
        clockId: provisioned.clock.id,
        frozenTime: new Date(
          new Date(currentPeriodEnd!).getTime() + 60 * 60 * 1000,
        ),
      });

      await waitForBrandPhase(provisioned.harness.brandId, "cancelled");
      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "subscription_deleted",
      });

      const cancelledState = await waitForCondition({
        description: `cancelled billing projection for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.lifecycle?.phase === "cancelled" &&
          state.billing?.stripeSubscriptionId === null &&
          state.billing.pendingCancellation === false,
      });

      expect(cancelledState.lifecycle?.cancelledAt).toBeTruthy();
      expect(cancelledState.lifecycle?.hardDeleteAfter).toBeTruthy();
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
