/**
 * Unit tests for Stripe top-up Checkout session creation.
 */
import "../../setup-env";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import {
  ONBOARDING_DISCOUNT_CAP,
  PASSPORTS_PRICE_IDS,
  TOPUP_RATES,
} from "../../../src/lib/stripe/config";

const mockCouponsCreate = mock(async (_params?: Record<string, unknown>) => ({
  id: "coupon_test",
}));
const mockSessionsList = mock(async (_params?: Record<string, unknown>) => ({
  data: [] as Array<unknown>,
}));
const mockSessionsExpire = mock(async (_sessionId?: string) => ({}));
const mockSessionsCreate = mock(
  async (_params?: Record<string, unknown>) => ({
    id: "cs_test_created",
    url: "https://checkout.stripe.com/topup-test" as string | null,
  }),
);

const mockStripeClient = {
  coupons: {
    create: mockCouponsCreate,
  },
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
}));

const { createTopupCheckoutSession } = await import(
  "../../../src/lib/stripe/topup"
);

/**
 * Builds a Stripe-like open Checkout session fixture for reuse/expiry tests.
 */
function buildOpenSession(params: {
  id: string;
  brandId: string;
  tier: "starter" | "growth" | "scale";
  quantity: number;
  onboardingDiscount: boolean;
  url?: string | null;
  mode?: "payment" | "subscription";
}): Record<string, unknown> {
  return {
    id: params.id,
    mode: params.mode ?? "payment",
    client_reference_id: params.brandId,
    url: params.url ?? "https://checkout.stripe.com/reused-session",
    metadata: {
      tier: params.tier,
      topup_quantity: String(params.quantity),
      is_onboarding_discount: String(params.onboardingDiscount),
    },
  };
}

describe("createTopupCheckoutSession", () => {
  beforeEach(() => {
    // Reset every Stripe mock so each case can assert the exact branch it exercises.
    mockCouponsCreate.mockClear();
    mockSessionsList.mockClear();
    mockSessionsExpire.mockClear();
    mockSessionsCreate.mockClear();

    mockSessionsList.mockImplementation(async (_params?: Record<string, unknown>) => ({
      data: [],
    }));
    mockSessionsCreate.mockImplementation(async () => ({
      id: "cs_test_created",
      url: "https://checkout.stripe.com/topup-test" as string | null,
    }));
    mockCouponsCreate.mockImplementation(async (_params?: Record<string, unknown>) => ({
      id: "coupon_test",
    }));
    mockSessionsExpire.mockImplementation(async (_sessionId?: string) => ({}));
  });

  it("creates a 50%-off coupon when the requested quantity is within the onboarding cap", async () => {
    await createTopupCheckoutSession({
      stripeCustomerId: "cus_topup_coupon_percent",
      brandId: "brand_topup_coupon_percent",
      tier: "growth",
      quantity: 600,
      applyOnboardingDiscount: true,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockCouponsCreate).toHaveBeenCalledTimes(1);
    expect(mockCouponsCreate.mock.calls[0]?.[0]).toMatchObject({
      percent_off: 50,
      duration: "once",
      metadata: {
        brand_id: "brand_topup_coupon_percent",
        tier: "growth",
        topup_quantity: "600",
      },
    });

    expect(mockSessionsCreate.mock.calls[0]?.[0]).toMatchObject({
      mode: "payment",
      customer: "cus_topup_coupon_percent",
      client_reference_id: "brand_topup_coupon_percent",
      line_items: [
        { price: PASSPORTS_PRICE_IDS.growth, quantity: 600 },
      ],
      discounts: [{ coupon: "coupon_test" }],
    });
  });

  it("creates a fixed amount-off coupon when the request exceeds the onboarding cap", async () => {
    const quantity = ONBOARDING_DISCOUNT_CAP.starter + 200;

    await createTopupCheckoutSession({
      stripeCustomerId: "cus_topup_coupon_amount",
      brandId: "brand_topup_coupon_amount",
      tier: "starter",
      quantity,
      applyOnboardingDiscount: true,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockCouponsCreate).toHaveBeenCalledTimes(1);
    expect(mockCouponsCreate.mock.calls[0]?.[0]).toMatchObject({
      amount_off: Math.round(
        ONBOARDING_DISCOUNT_CAP.starter *
          TOPUP_RATES.starter *
          0.5,
      ),
      currency: "eur",
      duration: "once",
      metadata: {
        brand_id: "brand_topup_coupon_amount",
        tier: "starter",
        topup_quantity: String(quantity),
        capped_credits: String(ONBOARDING_DISCOUNT_CAP.starter),
      },
    });
  });

  it("skips coupon creation when onboarding discount is unavailable", async () => {
    await createTopupCheckoutSession({
      stripeCustomerId: "cus_topup_no_discount",
      brandId: "brand_topup_no_discount",
      tier: "scale",
      quantity: 1000,
      applyOnboardingDiscount: false,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockCouponsCreate).not.toHaveBeenCalled();
    expect(mockSessionsCreate.mock.calls[0]?.[0]).toMatchObject({
      line_items: [
        { price: PASSPORTS_PRICE_IDS.scale, quantity: 1000 },
      ],
    });
    expect(mockSessionsCreate.mock.calls[0]?.[0]).not.toHaveProperty("discounts");
  });

  it("reuses a matching open payment session for the same brand and quantity", async () => {
    mockSessionsList.mockImplementation(async (_params?: Record<string, unknown>) => ({
      data: [
        buildOpenSession({
          id: "cs_test_reused",
          brandId: "brand_topup_reuse",
          tier: "growth",
          quantity: 1200,
          onboardingDiscount: false,
          url: "https://checkout.stripe.com/reused-topup",
        }),
      ],
    }));

    const result = await createTopupCheckoutSession({
      stripeCustomerId: "cus_topup_reuse",
      brandId: "brand_topup_reuse",
      tier: "growth",
      quantity: 1200,
      applyOnboardingDiscount: false,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(result).toEqual({
      sessionId: "cs_test_reused",
      url: "https://checkout.stripe.com/reused-topup",
    });
    expect(mockSessionsExpire).not.toHaveBeenCalled();
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("expires stale brand-scoped payment sessions before creating a new one", async () => {
    mockSessionsList.mockImplementation(async (_params?: Record<string, unknown>) => ({
      data: [
        buildOpenSession({
          id: "cs_test_stale_brand_payment",
          brandId: "brand_topup_expire",
          tier: "growth",
          quantity: 300,
          onboardingDiscount: false,
        }),
        buildOpenSession({
          id: "cs_test_other_brand",
          brandId: "another_brand",
          tier: "growth",
          quantity: 300,
          onboardingDiscount: false,
        }),
        buildOpenSession({
          id: "cs_test_subscription_mode",
          brandId: "brand_topup_expire",
          tier: "growth",
          quantity: 300,
          onboardingDiscount: false,
          mode: "subscription",
        }),
      ],
    }));

    await createTopupCheckoutSession({
      stripeCustomerId: "cus_topup_expire",
      brandId: "brand_topup_expire",
      tier: "growth",
      quantity: 600,
      applyOnboardingDiscount: false,
      successUrl: "https://example.com/success",
      cancelUrl: "https://example.com/cancel",
    });

    expect(mockSessionsExpire).toHaveBeenCalledTimes(1);
    expect(mockSessionsExpire).toHaveBeenCalledWith(
      "cs_test_stale_brand_payment",
    );
    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
  });

  it("throws when Stripe returns a Checkout session without a URL", async () => {
    mockSessionsCreate.mockImplementation(async (_params?: Record<string, unknown>) => ({
      id: "cs_test_missing_url",
      url: null as string | null,
    }));

    await expect(
      createTopupCheckoutSession({
        stripeCustomerId: "cus_topup_missing_url",
        brandId: "brand_topup_missing_url",
        tier: "starter",
        quantity: 100,
        applyOnboardingDiscount: false,
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
      }),
    ).rejects.toThrow("Stripe Checkout Session was created without a URL");
  });
});
