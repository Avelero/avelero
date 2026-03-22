/**
 * Live Stripe tests for billing status refresh against real subscription state.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { testDb } from "@v1/db/testing";
import {
  ensureLiveStripePriceCatalog,
  provisionActiveStripeBillingBrand,
  waitForCondition,
} from "./helpers/live-billing";

beforeAll(async () => {
  // Validate the sandbox price catalog before exercising live refresh logic.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe billing status refresh", () => {
  it("refreshes stale local state from real Stripe subscription data", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Status Refresh",
      tier: "growth",
      interval: "quarterly",
      includeImpact: true,
    });

    try {
      await provisioned.stripe.subscriptions.update(provisioned.subscription.id, {
        cancel_at_period_end: true,
      });

      await waitForCondition({
        description: `pending cancellation before stale refresh for ${provisioned.harness.brandId}`,
        evaluate: async () =>
          provisioned.harness.caller.brand.billing.getStatus(),
        isDone: (status) => status.pending_cancellation === true,
      });

      await testDb
        .update(schema.brandPlan)
        .set({
          planType: null,
          billingInterval: null,
          hasImpactPredictions: false,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(schema.brandPlan.brandId, provisioned.harness.brandId));

      await testDb
        .update(schema.brandBilling)
        .set({
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pendingCancellation: false,
          updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        })
        .where(eq(schema.brandBilling.brandId, provisioned.harness.brandId));

      const refreshed = await provisioned.harness.caller.brand.billing.getStatus();

      expect(refreshed.plan_type).toBe("growth");
      expect(refreshed.billing_interval).toBe("quarterly");
      expect(refreshed.has_impact_predictions).toBe(true);
      expect(refreshed.pending_cancellation).toBe(true);
      expect(refreshed.current_period_start).toBeTruthy();
      expect(refreshed.current_period_end).toBeTruthy();
      expect(refreshed.has_active_subscription).toBe(true);
      expect(refreshed.stripe_customer_id).toBe(provisioned.customer.id);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
