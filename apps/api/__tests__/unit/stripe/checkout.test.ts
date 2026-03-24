/**
 * Unit tests for Stripe subscription Checkout session creation and reuse.
 */
import "../../setup-env";

import { beforeEach, describe, expect, it, mock } from "bun:test";

const mockSessionsList = mock(async (_params?: Record<string, unknown>) => ({
  data: [] as Array<unknown>,
}));
const mockSessionsExpire = mock(async (_sessionId?: string) => ({}));
const mockSessionsCreate = mock(
  async (_params?: Record<string, unknown>) => ({
    id: "cs_test_created",
    url: "https://checkout.stripe.com/subscription-test" as string | null,
  }),
);

const mockStripeClient = {
  checkout: {
    sessions: {
      list: mockSessionsList,
      expire: mockSessionsExpire,
      create: mockSessionsCreate,
    },
  },
};

mock.module("../../../src/lib/stripe/client.js", () => ({
  getStripeClient: () => mockStripeClient as any,
  createStripeClient: () => mockStripeClient as any,
  resetStripeClient: () => {},
  isStripeError: () => false,
}));

const { createCheckoutSession, createUpgradeCheckoutSession } = await import(
  "../../../src/lib/stripe/checkout"
);

/**
 * Builds a Stripe-like open subscription Checkout session fixture.
 */
function buildOpenSession(params: {
  id: string;
  brandId: string;
  tier: "starter" | "growth" | "scale";
  interval: "quarterly" | "yearly";
  includeImpact: boolean;
  upgradeFromSubscriptionId?: string;
  url?: string | null;
}): Record<string, unknown> {
  // Mirror the metadata keys the production Checkout helpers use for matching.
  return {
    id: params.id,
    mode: "subscription",
    client_reference_id: params.brandId,
    url: params.url ?? "https://checkout.stripe.com/reused-session",
    metadata: {
      plan_type: params.tier,
      billing_interval: params.interval,
      include_impact: String(params.includeImpact),
      ...(params.upgradeFromSubscriptionId
        ? {
            upgrade_from_subscription_id: params.upgradeFromSubscriptionId,
          }
        : {}),
    },
  };
}

describe("stripe checkout helpers", () => {
  beforeEach(() => {
    // Reset every Stripe mock so each test can assert a single reuse branch.
    mockSessionsList.mockClear();
    mockSessionsExpire.mockClear();
    mockSessionsCreate.mockClear();

    mockSessionsList.mockImplementation(async () => ({
      data: [],
    }));
    mockSessionsExpire.mockImplementation(async () => ({}));
    mockSessionsCreate.mockImplementation(async () => ({
      id: "cs_test_created",
      url: "https://checkout.stripe.com/subscription-test" as string | null,
    }));
  });

  it("reuses a matching regular subscription checkout session", async () => {
    mockSessionsList.mockImplementation(async () => ({
      data: [
        buildOpenSession({
          id: "cs_test_reused_regular",
          brandId: "brand_regular_reuse",
          tier: "growth",
          interval: "quarterly",
          includeImpact: false,
          url: "https://checkout.stripe.com/reused-regular",
        }),
      ],
    }));

    const result = await createCheckoutSession({
      brandId: "brand_regular_reuse",
      stripeCustomerId: "cus_regular_reuse",
      tier: "growth",
      interval: "quarterly",
      includeImpact: false,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result).toEqual({
      sessionId: "cs_test_reused_regular",
      url: "https://checkout.stripe.com/reused-regular",
    });
    expect(mockSessionsExpire).not.toHaveBeenCalled();
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("does not reuse a regular checkout session for an upgrade flow", async () => {
    mockSessionsList.mockImplementation(async () => ({
      data: [
        buildOpenSession({
          id: "cs_test_regular_session",
          brandId: "brand_upgrade_guard",
          tier: "growth",
          interval: "quarterly",
          includeImpact: true,
          url: "https://checkout.stripe.com/regular-session",
        }),
      ],
    }));

    const result = await createUpgradeCheckoutSession({
      brandId: "brand_upgrade_guard",
      stripeCustomerId: "cus_upgrade_guard",
      stripeSubscriptionId: "sub_existing_upgrade_guard",
      newTier: "growth",
      newInterval: "quarterly",
      includeImpact: true,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result).toEqual({
      sessionId: "cs_test_created",
      url: "https://checkout.stripe.com/subscription-test",
    });
    expect(mockSessionsExpire).toHaveBeenCalledWith("cs_test_regular_session");
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    expect(mockSessionsCreate.mock.calls[0]?.[0]).toMatchObject({
      metadata: {
        upgrade_from_subscription_id: "sub_existing_upgrade_guard",
      },
      subscription_data: {
        metadata: {
          upgrade_from_subscription_id: "sub_existing_upgrade_guard",
        },
      },
    });
  });

  it("reuses a matching upgrade checkout session when the source subscription matches", async () => {
    mockSessionsList.mockImplementation(async () => ({
      data: [
        buildOpenSession({
          id: "cs_test_reused_upgrade",
          brandId: "brand_upgrade_reuse",
          tier: "scale",
          interval: "yearly",
          includeImpact: true,
          upgradeFromSubscriptionId: "sub_existing_upgrade_reuse",
          url: "https://checkout.stripe.com/reused-upgrade",
        }),
      ],
    }));

    const result = await createUpgradeCheckoutSession({
      brandId: "brand_upgrade_reuse",
      stripeCustomerId: "cus_upgrade_reuse",
      stripeSubscriptionId: "sub_existing_upgrade_reuse",
      newTier: "scale",
      newInterval: "yearly",
      includeImpact: true,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result).toEqual({
      sessionId: "cs_test_reused_upgrade",
      url: "https://checkout.stripe.com/reused-upgrade",
    });
    expect(mockSessionsExpire).not.toHaveBeenCalled();
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });
});
