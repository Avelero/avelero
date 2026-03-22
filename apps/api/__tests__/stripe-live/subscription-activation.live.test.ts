/**
 * Live Stripe tests for subscription activation (simulating checkout completion).
 *
 * Since we cannot click through a Stripe Checkout UI in a test, we create a
 * subscription directly on a test clock customer. The `customer.subscription.created`
 * and `customer.subscription.updated` webhooks fire and activate the brand through
 * the same handler path as a real checkout completion.
 */
import { beforeAll, describe, expect, it } from "bun:test";
import {
  createClockCustomer,
  createLiveBillingBrand,
  createLiveStripeCleanupTracker,
  createLiveTestSuffix,
  createStripeSubscriptionForBrand,
  createStripeTestClock,
  ensureLiveStripePriceCatalog,
  getLiveStripeClient,
  readLiveBrandBillingState,
  waitForBrandPhase,
  waitForLiveSubscriptionProjection,
} from "./helpers/live-billing";

beforeAll(async () => {
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe subscription activation", () => {
  it("activates a demo brand after a subscription is created", async () => {
    const stripe = getLiveStripeClient();
    const cleanup = createLiveStripeCleanupTracker(stripe);
    const testRunId = createLiveTestSuffix();

    // Start with a brand in demo phase (no subscription, no plan)
    const harness = await createLiveBillingBrand({
      namePrefix: "Activation Demo",
      phase: "demo",
    });

    const clock = await createStripeTestClock({
      stripe,
      frozenTime: new Date(),
      name: `${harness.brandId}-activation-clock`,
    });
    cleanup.trackClock(clock.id);

    const { customer } = await createClockCustomer({
      stripe,
      clockId: clock.id,
      brandId: harness.brandId,
      email: harness.ownerEmail,
      name: harness.brandName,
      testRunId,
      scenario: "activation",
    });
    cleanup.trackCustomer(customer.id);

    // Create a real subscription — this triggers webhooks that should activate the brand
    const subscription = await createStripeSubscriptionForBrand({
      stripe,
      customerId: customer.id,
      brandId: harness.brandId,
      tier: "starter",
      interval: "quarterly",
      includeImpact: false,
      testRunId,
      scenario: "activation",
    });
    cleanup.trackSubscription(subscription.id);

    try {
      // Wait for the brand to transition from demo → active via webhook
      await waitForBrandPhase(harness.brandId, "active");
      await waitForLiveSubscriptionProjection(harness.brandId);

      const state = await readLiveBrandBillingState(harness.brandId);

      expect(state.lifecycle?.phase).toBe("active");
      expect(state.billing?.stripeSubscriptionId).toBe(subscription.id);
      expect(state.billing?.stripeCustomerId).toBe(customer.id);
      expect(state.billing?.currentPeriodStart).toBeTruthy();
      expect(state.billing?.currentPeriodEnd).toBeTruthy();
      expect(state.plan?.planType).toBe("starter");
      expect(state.plan?.billingInterval).toBe("quarterly");
    } finally {
      await cleanup.cleanup();
    }
  });
});
