/**
 * Integration tests for billing router plan-change and top-up guardrails.
 */
import "../../setup";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import Stripe from "stripe";
import { createTestBrand, createTestUser } from "@v1/db/testing";

// Ensure this test file has a working Stripe client (guards against global
// mock.module leaking from other test files).
const stripeClient = new Stripe("sk_test_codex");
mock.module("../../../src/lib/stripe/client.js", () => ({
  getStripeClient: () => stripeClient,
  createStripeClient: (key?: string) => new Stripe(key ?? "sk_test_codex"),
  resetStripeClient: () => {},
  isStripeError: (err: unknown) => err instanceof Stripe.errors.StripeError,
}));

import {
  addBrandMember,
  createMockContext,
  setBrandSubscriptionState,
} from "../../helpers/billing";

const mockCreateCheckoutSession = mock(async (_params?: Record<string, unknown>) => ({
  sessionId: "cs_test_checkout",
  url: "https://checkout.stripe.com/create-subscription",
}));
const mockCreateUpgradeCheckoutSession = mock(async (_params?: Record<string, unknown>) => ({
  sessionId: "cs_test_upgrade",
  url: "https://checkout.stripe.com/create-upgrade",
}));
const mockCreateTopupCheckoutSession = mock(async (_params?: Record<string, unknown>) => ({
  sessionId: "cs_test_topup",
  url: "https://checkout.stripe.com/create-topup",
}));
const mockUpdateSubscriptionPlan = mock(async (_params?: Record<string, unknown>) => {});
const mockAddImpactToSubscription = mock(async (_params?: Record<string, unknown>) => {});
const mockRemoveImpactFromSubscription = mock(async (_params?: Record<string, unknown>) => {});

mock.module("../../../src/lib/stripe/checkout.js", () => ({
  createCheckoutSession: mockCreateCheckoutSession,
  createUpgradeCheckoutSession: mockCreateUpgradeCheckoutSession,
}));

mock.module("../../../src/lib/stripe/topup.js", () => ({
  createTopupCheckoutSession: mockCreateTopupCheckoutSession,
}));

mock.module("../../../src/lib/stripe/subscription.js", () => ({
  addImpactToSubscription: mockAddImpactToSubscription,
  removeImpactFromSubscription: mockRemoveImpactFromSubscription,
  updateSubscriptionPlan: mockUpdateSubscriptionPlan,
}));

const { appRouter } = await import("../../../src/trpc/routers/_app");

/**
 * Creates a billing-router caller for the current test brand membership.
 */
function createBillingCaller(params: {
  brandId: string;
  userId: string;
  userEmail: string;
}) {
  return appRouter.createCaller(
    createMockContext({
      userId: params.userId,
      userEmail: params.userEmail,
      brandId: params.brandId,
      role: "owner",
    }),
  ).brand.billing;
}

describe("billing router plan and top-up flows", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    // Reset every mock so each test asserts a single billing branch.
    mockCreateCheckoutSession.mockClear();
    mockCreateUpgradeCheckoutSession.mockClear();
    mockCreateTopupCheckoutSession.mockClear();
    mockUpdateSubscriptionPlan.mockClear();
    mockAddImpactToSubscription.mockClear();
    mockRemoveImpactFromSubscription.mockClear();

    userEmail = `billing-router-${Math.random().toString(36).slice(2, 10)}@example.com`;
    userId = await createTestUser(userEmail);
    brandId = await createTestBrand("Billing Router Test Brand");
    await addBrandMember(userId, brandId);
  });

  it("rejects top-up checkout when the Stripe subscription is missing", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_missing_sub",
      stripeSubscriptionId: null,
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.createTopupCheckout({ quantity: 100 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Additional credits are only available"),
    });
    expect(mockCreateTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects top-up checkout when the billing mode is not Stripe Checkout", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "quarterly",
      billingMode: "stripe_invoice",
      stripeCustomerId: "cus_invoice_mode",
      stripeSubscriptionId: "sub_invoice_mode",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.createTopupCheckout({ quantity: 100 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Additional credits are only available"),
    });
    expect(mockCreateTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects top-up checkout when the brand is not active", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "past_due",
      planType: "growth",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_inactive_topup",
      stripeSubscriptionId: "sub_inactive_topup",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.createTopupCheckout({ quantity: 100 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("active brands"),
    });
    expect(mockCreateTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("rejects top-up checkout when current plan metadata is missing", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: null,
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_missing_plan",
      stripeSubscriptionId: "sub_missing_plan",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.createTopupCheckout({ quantity: 100 }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Current plan metadata is missing"),
    });
    expect(mockCreateTopupCheckoutSession).not.toHaveBeenCalled();
  });

  it("passes the current tier and onboarding flag into top-up checkout creation", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_topup_args",
      stripeSubscriptionId: "sub_topup_args",
      onboardingDiscountUsed: false,
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });
    const result = await caller.createTopupCheckout({ quantity: 600 });

    expect(result.url).toBe("https://checkout.stripe.com/create-topup");
    expect(mockCreateTopupCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mockCreateTopupCheckoutSession.mock.calls[0]?.[0]).toMatchObject({
      brandId,
      stripeCustomerId: "cus_topup_args",
      tier: "growth",
      quantity: 600,
      applyOnboardingDiscount: true,
      successUrl: expect.stringContaining("checkout=success&topup=600"),
    });
  });

  it("suppresses the onboarding discount flag after the first discounted top-up", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_topup_repeat",
      stripeSubscriptionId: "sub_topup_repeat",
      onboardingDiscountUsed: true,
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });
    await caller.createTopupCheckout({ quantity: 200 });

    expect(mockCreateTopupCheckoutSession.mock.calls[0]?.[0]).toMatchObject({
      tier: "starter",
      quantity: 200,
      applyOnboardingDiscount: false,
    });
  });

  it("allows only true upgrades through createUpgradeCheckout", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_upgrade_allowed",
      stripeSubscriptionId: "sub_upgrade_allowed",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });
    const result = await caller.createUpgradeCheckout({
      tier: "growth",
      interval: "quarterly",
      include_impact: false,
    });

    expect(result.url).toBe("https://checkout.stripe.com/create-upgrade");
    expect(mockCreateUpgradeCheckoutSession.mock.calls[0]?.[0]).toMatchObject({
      brandId,
      stripeCustomerId: "cus_upgrade_allowed",
      stripeSubscriptionId: "sub_upgrade_allowed",
      newTier: "growth",
      newInterval: "quarterly",
      includeImpact: false,
    });
  });

  it("routes same-tier quarterly to yearly through the upgrade checkout flow", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_same_tier_upgrade",
      stripeSubscriptionId: "sub_same_tier_upgrade",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });
    await caller.createUpgradeCheckout({
      tier: "starter",
      interval: "yearly",
      include_impact: true,
    });

    expect(mockCreateUpgradeCheckoutSession).toHaveBeenCalledTimes(1);
    expect(mockCreateUpgradeCheckoutSession.mock.calls[0]?.[0]).toMatchObject({
      newTier: "starter",
      newInterval: "yearly",
      includeImpact: true,
    });
  });

  it("rejects same-tier yearly to quarterly changes through createUpgradeCheckout", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "yearly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_same_tier_downgrade",
      stripeSubscriptionId: "sub_same_tier_downgrade",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.createUpgradeCheckout({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("downgrade"),
    });
    expect(mockCreateUpgradeCheckoutSession).not.toHaveBeenCalled();
  });

  it("blocks upgrades through updatePlan and allows downgrades", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_update_plan_guard",
      stripeSubscriptionId: "sub_update_plan_guard",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });

    await expect(
      caller.updatePlan({
        tier: "growth",
        interval: "quarterly",
        include_impact: false,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("Upgrades must use the checkout flow"),
    });
    expect(mockUpdateSubscriptionPlan).not.toHaveBeenCalled();

    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "yearly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_update_plan_guard",
      stripeSubscriptionId: "sub_update_plan_guard",
    });

    await expect(
      caller.updatePlan({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      }),
    ).resolves.toEqual({ success: true });

    expect(mockUpdateSubscriptionPlan).toHaveBeenCalledTimes(1);
    expect(mockUpdateSubscriptionPlan.mock.calls[0]?.[0]).toMatchObject({
      stripeSubscriptionId: "sub_update_plan_guard",
      newTier: "starter",
      newInterval: "quarterly",
      hasImpact: false,
    });
  });

  it("routes same-tier yearly to quarterly changes through updatePlan", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "yearly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_same_tier_update",
      stripeSubscriptionId: "sub_same_tier_update",
    });

    const caller = createBillingCaller({ brandId, userId, userEmail });
    const result = await caller.updatePlan({
      tier: "growth",
      interval: "quarterly",
      include_impact: true,
    });

    expect(result).toEqual({ success: true });
    expect(mockUpdateSubscriptionPlan).toHaveBeenCalledTimes(1);
    expect(mockUpdateSubscriptionPlan.mock.calls[0]?.[0]).toMatchObject({
      stripeSubscriptionId: "sub_same_tier_update",
      newTier: "growth",
      newInterval: "quarterly",
      hasImpact: true,
    });
  });
});
