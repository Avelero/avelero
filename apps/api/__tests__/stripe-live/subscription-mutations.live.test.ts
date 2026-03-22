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
} from "./helpers/live-billing";

beforeAll(async () => {
  // Validate the live price catalog once before the mutation suite runs.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe subscription mutations", () => {
  it("renews a pending cancellation with a plan upgrade via updatePlan", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Renew Upgrade",
      tier: "starter",
      interval: "quarterly",
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

      // Renewals with pending cancellation bypass the upgrade guard
      const result = await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "growth",
        interval: "yearly",
        include_impact: false,
      });

      expect(result.success).toBe(true);

      await waitForCondition({
        description: `updated plan projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "growth" &&
          state.plan.billingInterval === "yearly" &&
          state.billing?.pendingCancellation === false,
      });

      await waitForBillingEvent({
        brandId: provisioned.harness.brandId,
        eventType: "subscription_updated",
      });
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("blocks upgrades through updatePlan when no pending cancellation", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Upgrade Guard",
      tier: "starter",
      interval: "quarterly",
      includeImpact: false,
    });

    try {
      await expect(
        provisioned.harness.caller.brand.billing.updatePlan({
          tier: "growth",
          interval: "yearly",
          include_impact: false,
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });

      // Plan should be unchanged
      const state = await readLiveBrandBillingState(
        provisioned.harness.brandId,
      );
      expect(state.plan?.planType).toBe("starter");
      expect(state.plan?.billingInterval).toBe("quarterly");
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("creates an upgrade checkout session with prorated credit coupon", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Upgrade Checkout",
      tier: "starter",
      interval: "quarterly",
      includeImpact: false,
    });

    try {
      const result =
        await provisioned.harness.caller.brand.billing.createUpgradeCheckout({
          tier: "growth",
          interval: "quarterly",
          include_impact: false,
        });

      expect(result.url).toContain("stripe.com");

      // Verify the checkout session has a coupon discount
      const sessions = await provisioned.stripe.checkout.sessions.list({
        customer: provisioned.customer.id,
        limit: 5,
        status: "open",
      });

      const upgradeSession = sessions.data.find(
        (s) => s.metadata?.upgrade_from_subscription_id === provisioned.subscription.id,
      );
      expect(upgradeSession).toBeDefined();
      expect(upgradeSession!.metadata?.upgrade_coupon_id).toBeTruthy();

      // Verify the coupon exists and has the right amount
      const coupon = await provisioned.stripe.coupons.retrieve(
        upgradeSession!.metadata!.upgrade_coupon_id!,
      );
      expect(coupon.duration).toBe("once");
      expect(coupon.amount_off).toBeGreaterThan(0);

      // Old subscription should still be active
      const oldSub = await provisioned.stripe.subscriptions.retrieve(
        provisioned.subscription.id,
      );
      expect(oldSub.status).toBe("active");

      // Clean up: expire the session and delete the coupon
      await provisioned.stripe.checkout.sessions.expire(upgradeSession!.id);
      await provisioned.stripe.coupons.del(coupon.id);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("blocks downgrade through createUpgradeCheckout", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Downgrade Guard",
      tier: "growth",
      interval: "yearly",
      includeImpact: false,
    });

    try {
      await expect(
        provisioned.harness.caller.brand.billing.createUpgradeCheckout({
          tier: "starter",
          interval: "quarterly",
          include_impact: false,
        }),
      ).rejects.toMatchObject({
        code: "PRECONDITION_FAILED",
      });
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("backfills missing local plan metadata before adding impact and then removes it", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Impact Mutation Backfill",
      tier: "starter",
      interval: "quarterly",
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
          state.plan.billingInterval === "quarterly" &&
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
        interval: "quarterly",
        include_impact: false,
      });

      expect(result.success).toBe(true);

      await waitForCondition({
        description: `downgraded plan projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "starter" &&
          state.plan.billingInterval === "quarterly" &&
          state.plan.hasImpactPredictions === false,
      });
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
