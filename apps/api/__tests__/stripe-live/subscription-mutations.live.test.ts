/**
 * Live Stripe tests for subscription mutations through the billing router.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { testDb } from "@v1/db/testing";
import { ensureLiveStripePriceCatalog } from "./helpers/live-billing";
import {
  provisionActiveStripeBillingBrand,
  readLiveBrandBillingState,
  waitForBillingEvent,
  waitForCondition,
  waitForInvoiceProjection,
} from "./helpers/live-billing";

/**
 * Lists real Stripe invoices for a subscription and filters to proration updates.
 */
async function listProrationInvoices(params: {
  stripe: Awaited<ReturnType<typeof provisionActiveStripeBillingBrand>>["stripe"];
  subscriptionId: string;
}) {
  const invoices = await params.stripe.invoices.list({
    subscription: params.subscriptionId,
    limit: 10,
  });

  return invoices.data.filter(
    (invoice) =>
      invoice.billing_reason === "subscription_update" && invoice.total > 0,
  );
}

beforeAll(async () => {
  // Validate the live price catalog once before the mutation suite runs.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe subscription mutations", () => {
  it("updates the plan with real proration and clears pending cancellation", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Upgrade",
      tier: "starter",
      interval: "monthly",
      includeImpact: false,
    });

    try {
      await provisioned.stripe.subscriptions.update(provisioned.subscription.id, {
        cancel_at_period_end: true,
      });

      await waitForCondition({
        description: `pending cancellation for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) => state.billing?.pendingCancellation === true,
      });

      const result = await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "growth",
        interval: "yearly",
        include_impact: true,
      });

      expect(result.success).toBe(true);

      await waitForCondition({
        description: `updated plan projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "growth" &&
          state.plan.billingInterval === "yearly" &&
          state.plan.hasImpactPredictions === true &&
          state.billing?.pendingCancellation === false,
      });

      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "subscription_updated",
      });

      const prorationInvoices = await listProrationInvoices({
        stripe: provisioned.stripe,
        subscriptionId: provisioned.subscription.id,
      });
      expect(prorationInvoices.length).toBeGreaterThan(0);

      const latestProrationInvoice = prorationInvoices[0]!;
      const projectedInvoice = await waitForInvoiceProjection({
        brandId: provisioned.harness.brandId,
        invoiceId: latestProrationInvoice.id,
      });

      expect(projectedInvoice.total).toBe(latestProrationInvoice.total);
      expect(projectedInvoice.amountDue).toBe(latestProrationInvoice.amount_due);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("backfills missing local plan metadata before adding impact and then removes it", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Impact Mutation Backfill",
      tier: "starter",
      interval: "monthly",
      includeImpact: false,
    });

    try {
      await testDb
        .update(schema.brandPlan)
        .set({
          planType: null,
          billingInterval: null,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.brandPlan.brandId, provisioned.harness.brandId));

      const added = await provisioned.harness.caller.brand.billing.addImpact();
      expect(added.success).toBe(true);

      await waitForCondition({
        description: `impact enabled for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "starter" &&
          state.plan.billingInterval === "monthly" &&
          state.plan.hasImpactPredictions === true,
      });

      const removed =
        await provisioned.harness.caller.brand.billing.removeImpact();
      expect(removed.success).toBe(true);

      await waitForCondition({
        description: `impact disabled for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) => state.plan?.hasImpactPredictions === false,
      });

      const prorationInvoices = await listProrationInvoices({
        stripe: provisioned.stripe,
        subscriptionId: provisioned.subscription.id,
      });
      expect(prorationInvoices.length).toBeGreaterThanOrEqual(2);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("downgrades the subscription with real Stripe state propagation", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Downgrade",
      tier: "growth",
      interval: "yearly",
      includeImpact: true,
    });

    try {
      const result = await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "starter",
        interval: "monthly",
        include_impact: false,
      });

      expect(result.success).toBe(true);

      await waitForCondition({
        description: `downgraded plan projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "starter" &&
          state.plan.billingInterval === "monthly" &&
          state.plan.hasImpactPredictions === false,
      });
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
