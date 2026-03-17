/**
 * Verifies how Stripe subscription periods are projected into local billing state.
 */
import { describe, expect, it } from "bun:test";
import type Stripe from "stripe";
import { resolveSubscriptionProjection } from "../../../src/lib/stripe/projection";

/**
 * Builds a minimal Stripe subscription object for projection tests.
 */
function buildSubscription(
  overrides: Partial<Stripe.Subscription> = {},
): Stripe.Subscription {
  return {
    id: "sub_projection_test",
    object: "subscription",
    current_period_start: 1_700_000_000,
    current_period_end: 1_700_086_400,
    customer: "cus_projection_test",
    items: {
      object: "list",
      data: [
        {
          id: "si_projection_test",
          object: "subscription_item",
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
          price: {
            id: "price_unrecognised",
          },
        },
      ],
      has_more: false,
      url: "/v1/subscription_items",
    },
    ...overrides,
  } as Stripe.Subscription;
}

describe("resolveSubscriptionProjection", () => {
  it("falls back to the subscription-level period when no Avelero price is recognised", () => {
    const subscription = buildSubscription();

    expect(resolveSubscriptionProjection(subscription)).toMatchObject({
      currentPeriodStart: "2023-11-14T22:13:20.000Z",
      currentPeriodEnd: "2023-11-15T22:13:20.000Z",
      planType: null,
      billingInterval: null,
    });
  });
});
