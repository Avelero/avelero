/**
 * Verifies how Stripe subscription cancellation scheduling is projected locally.
 */
import { describe, expect, it } from "bun:test";
import type Stripe from "stripe";
import { isStripeSubscriptionPendingCancellation } from "../../../src/lib/stripe/projection";

/**
 * Builds a minimal Stripe subscription object for cancellation-state tests.
 */
function buildSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_test",
    object: "subscription",
    cancel_at: null,
    cancel_at_period_end: false,
    canceled_at: null,
    ended_at: null,
    ...overrides,
  } as Stripe.Subscription;
}

describe("isStripeSubscriptionPendingCancellation", () => {
  it("treats cancel_at_period_end as pending cancellation", () => {
    const subscription = buildSubscription({
      cancel_at_period_end: true,
    });

    expect(isStripeSubscriptionPendingCancellation(subscription)).toBe(true);
  });

  it("treats a future cancel_at as pending cancellation", () => {
    const subscription = buildSubscription({
      cancel_at: 1776356202,
      cancellation_details: {
        comment: null,
        feedback: null,
        reason: "cancellation_requested",
      },
    });

    expect(isStripeSubscriptionPendingCancellation(subscription)).toBe(true);
  });

  it("does not keep pending cancellation once the subscription is ended", () => {
    const subscription = buildSubscription({
      cancel_at: 1776356202,
      ended_at: 1776356202,
    });

    expect(isStripeSubscriptionPendingCancellation(subscription)).toBe(false);
  });
});
