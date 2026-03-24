/**
 * Live Stripe tests for subscription mutations through the billing router.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { testDb } from "@v1/db/testing";
import { PASSPORTS_PRICE_IDS } from "../../src/lib/stripe/config";
import { ensureLiveStripePriceCatalog } from "./helpers/live-billing";
import {
  advanceStripeTestClock,
  listCheckoutSessionLineItems,
  listOpenCheckoutSessions,
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
  it("renews a pending cancellation immediately when the plan stays the same", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Renew Downgrade",
      tier: "growth",
      interval: "yearly",
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
        include_impact: false,
      });

      expect(result).toEqual({
        success: true,
        changeTiming: "immediate",
      });

      await waitForCondition({
        description: `renewed plan projection for brand ${provisioned.harness.brandId}`,
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

  it("creates an upgrade checkout session without a proration coupon", async () => {
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
      expect(upgradeSession!.metadata?.upgrade_coupon_id).toBeUndefined();

      // Old subscription should still be active
      const oldSub = await provisioned.stripe.subscriptions.retrieve(
        provisioned.subscription.id,
      );
      expect(oldSub.status).toBe("active");

      // Clean up: expire the session so the shared sandbox does not accumulate open checkouts.
      await provisioned.stripe.checkout.sessions.expire(upgradeSession!.id);
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("creates a live top-up checkout session with the tier-priced unit line item", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Top-up Checkout",
      tier: "growth",
      interval: "quarterly",
      includeImpact: false,
    });

    try {
      const result = await provisioned.harness.caller.brand.billing.createTopupCheckout({
        quantity: 600,
      });

      expect(result.url).toContain("stripe.com");

      const openSessions = await listOpenCheckoutSessions({
        stripe: provisioned.stripe,
        customerId: provisioned.customer.id,
      });
      const topupSession = openSessions.find(
        (candidate) =>
          candidate.mode === "payment" &&
          candidate.client_reference_id === provisioned.harness.brandId &&
          candidate.metadata?.tier === "growth" &&
          candidate.metadata?.topup_quantity === "600",
      );

      expect(topupSession).toBeDefined();

      const lineItems = await listCheckoutSessionLineItems({
        stripe: provisioned.stripe,
        sessionId: topupSession!.id,
      });
      const priceIds = lineItems
        .map((item) =>
          typeof item.price === "string" ? item.price : item.price?.id ?? null,
        )
        .filter((value): value is string => !!value);
      const quantities = lineItems.map((item) => item.quantity ?? 0);

      expect(priceIds).toEqual([PASSPORTS_PRICE_IDS.growth]);
      expect(quantities).toEqual([600]);
      expect(topupSession?.url).toBe(result.url);
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

  it("schedules downgrades for the end of the current billing period", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Downgrade",
      tier: "growth",
      interval: "yearly",
      includeImpact: true,
    });

    try {
      const initialState = await readLiveBrandBillingState(
        provisioned.harness.brandId,
      );
      const originalPeriodEnd = initialState.billing?.currentPeriodEnd;
      expect(originalPeriodEnd).toBeTruthy();

      const result = await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      });

      expect(result).toEqual({
        success: true,
        changeTiming: "scheduled",
      });

      await waitForCondition({
        description: `scheduled downgrade projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "growth" &&
          state.plan.billingInterval === "yearly" &&
          state.plan.hasImpactPredictions === true &&
          state.billing?.currentPeriodEnd === originalPeriodEnd &&
          state.billing?.scheduledPlanType === "starter" &&
          state.billing?.scheduledBillingInterval === "quarterly" &&
          state.billing?.scheduledHasImpactPredictions === false &&
          state.billing?.scheduledPlanChangeEffectiveAt === originalPeriodEnd &&
          !!state.billing?.stripeSubscriptionScheduleId,
      });

      await advanceStripeTestClock({
        stripe: provisioned.stripe,
        clockId: provisioned.clock.id,
        frozenTime: new Date(
          new Date(originalPeriodEnd!).getTime() + 2 * 60 * 60 * 1000,
        ),
      });

      await waitForCondition({
        description: `effective downgraded plan projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "starter" &&
          state.plan.billingInterval === "quarterly" &&
          state.plan.hasImpactPredictions === false &&
          state.billing?.scheduledPlanType === null &&
          state.billing?.scheduledBillingInterval === null &&
          state.billing?.scheduledPlanChangeEffectiveAt === null,
      });
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });

  it("releases a scheduled downgrade when the active plan is reselected", async () => {
    const provisioned = await provisionActiveStripeBillingBrand({
      namePrefix: "Plan Mutation Cancel Downgrade",
      tier: "growth",
      interval: "yearly",
      includeImpact: true,
    });

    try {
      await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      });

      const scheduledState = await waitForCondition({
        description: `scheduled downgrade setup for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          !!state.billing?.stripeSubscriptionScheduleId &&
          state.billing?.scheduledPlanType === "starter" &&
          state.billing?.scheduledBillingInterval === "quarterly",
      });
      const scheduleId = scheduledState.billing?.stripeSubscriptionScheduleId;
      expect(scheduleId).toBeTruthy();

      const result = await provisioned.harness.caller.brand.billing.updatePlan({
        tier: "growth",
        interval: "yearly",
        include_impact: true,
      });

      expect(result).toEqual({
        success: true,
        changeTiming: "cancelled",
      });

      await waitForCondition({
        description: `cleared scheduled downgrade projection for brand ${provisioned.harness.brandId}`,
        evaluate: async () =>
          readLiveBrandBillingState(provisioned.harness.brandId),
        isDone: (state) =>
          state.plan?.planType === "growth" &&
          state.plan.billingInterval === "yearly" &&
          state.plan.hasImpactPredictions === true &&
          state.billing?.stripeSubscriptionScheduleId === null &&
          state.billing?.scheduledPlanType === null &&
          state.billing?.scheduledBillingInterval === null &&
          state.billing?.scheduledHasImpactPredictions === null &&
          state.billing?.scheduledPlanChangeEffectiveAt === null,
      });

      const releasedSchedule =
        await provisioned.stripe.subscriptionSchedules.retrieve(scheduleId!);
      expect(releasedSchedule.status).toBe("released");
    } finally {
      await provisioned.cleanup.cleanup();
    }
  });
});
