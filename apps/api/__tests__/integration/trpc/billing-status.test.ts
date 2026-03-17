/**
 * Integration Tests: Billing status refresh.
 *
 * Verifies billing status refresh failures return a stable tRPC error instead
 * of leaking the raw Stripe client exception.
 */

import "../../setup";

import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { getStripeClient } from "../../../src/lib/stripe/client";
import { appRouter } from "../../../src/trpc/routers/_app";

type BrandRole = "owner" | "member" | "avelero";

let ownerId: string;
let ownerEmail: string;

/**
 * Creates an authenticated tRPC context for billing router tests.
 */
function createMockContext(params: {
  userId: string;
  userEmail: string;
  brandId?: string | null;
  role?: BrandRole | null;
}): AuthenticatedTRPCContext {
  return {
    user: {
      id: params.userId,
      email: params.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: params.brandId ?? null,
    role: params.role ?? null,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Grants brand membership to a test user.
 */
async function addBrandMember(
  userId: string,
  brandId: string,
  role: BrandRole = "owner",
) {
  await testDb.insert(schema.brandMembers).values({
    userId,
    brandId,
    role,
  });
}

/**
 * Seeds the lifecycle, plan, and billing rows needed for billing status tests.
 */
async function setBrandBillingState(params: {
  brandId: string;
  stripeSubscriptionId: string;
  updatedAt?: string;
  planType?: "starter" | "growth" | "scale" | null;
  billingInterval?: "monthly" | "yearly" | null;
}) {
  const now = new Date().toISOString();
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const updatedAt = params.updatedAt ?? now;
  const planType = params.planType === undefined ? "starter" : params.planType;
  const billingInterval =
    params.billingInterval === undefined ? "monthly" : params.billingInterval;

  await testDb
    .insert(schema.brandLifecycle)
    .values({
      brandId: params.brandId,
      phase: "active",
      phaseChangedAt: now,
      trialStartedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      trialEndsAt: thirtyDaysFromNow.toISOString(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandLifecycle.brandId,
      set: {
        phase: "active",
        phaseChangedAt: now,
        trialStartedAt: new Date(
          Date.now() - 7 * 24 * 60 * 60 * 1000,
        ).toISOString(),
        trialEndsAt: thirtyDaysFromNow.toISOString(),
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      planType,
      billingInterval,
      skuAnnualLimit: 10,
      skuOnboardingLimit: 5,
      skuCountAtYearStart: 0,
      skuCountAtOnboardingStart: 0,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        planType,
        billingInterval,
        skuAnnualLimit: 10,
        skuOnboardingLimit: 5,
        skuCountAtYearStart: 0,
        skuCountAtOnboardingStart: 0,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandBilling)
    .values({
      brandId: params.brandId,
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_billing_status_test",
      stripeSubscriptionId: params.stripeSubscriptionId,
      currentPeriodStart: now,
      currentPeriodEnd: thirtyDaysFromNow.toISOString(),
      updatedAt,
    })
    .onConflictDoUpdate({
      target: schema.brandBilling.brandId,
      set: {
        billingMode: "stripe_checkout",
        stripeCustomerId: "cus_billing_status_test",
        stripeSubscriptionId: params.stripeSubscriptionId,
        currentPeriodStart: now,
        currentPeriodEnd: thirtyDaysFromNow.toISOString(),
        updatedAt,
      },
    });
}

beforeEach(async () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_codex";
  ownerEmail = `billing-${Math.random().toString(36).slice(2, 8)}@example.com`;
  ownerId = await createTestUser(ownerEmail);
});

describe("brand.billing.getStatus", () => {
  it("returns a user-facing internal error when Stripe refresh fails", async () => {
    const brandId = await createTestBrand("Billing Status Failure Brand");
    const stripeSubscriptionId = "sub_billing_status_failure";

    await addBrandMember(ownerId, brandId);
    await setBrandBillingState({
      brandId,
      stripeSubscriptionId,
      updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    });

    const stripe = getStripeClient();
    const retrieveSpy = spyOn(
      stripe.subscriptions,
      "retrieve",
    ).mockRejectedValue(new Error("Stripe API unavailable"));

    try {
      const caller = appRouter.createCaller(
        createMockContext({
          userId: ownerId,
          userEmail: ownerEmail,
          brandId,
          role: "owner",
        }),
      );

      await expect(caller.brand.billing.getStatus()).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to refresh billing status",
      });
    } finally {
      retrieveSpy.mockRestore();
    }
  });

  it("skips the live Stripe refresh while the local projection is still fresh", async () => {
    const brandId = await createTestBrand("Billing Status Fresh Projection Brand");
    const stripeSubscriptionId = "sub_billing_status_fresh";

    await addBrandMember(ownerId, brandId);
    await setBrandBillingState({
      brandId,
      stripeSubscriptionId,
      updatedAt: new Date().toISOString(),
    });

    const stripe = getStripeClient();
    const retrieveSpy = spyOn(
      stripe.subscriptions,
      "retrieve",
    ).mockRejectedValue(new Error("Stripe API unavailable"));

    try {
      const caller = appRouter.createCaller(
        createMockContext({
          userId: ownerId,
          userEmail: ownerEmail,
          brandId,
          role: "owner",
        }),
      );

      const result = await caller.brand.billing.getStatus();

      expect(result.stripe_customer_id).toBe("cus_billing_status_test");
      expect(retrieveSpy).not.toHaveBeenCalled();
    } finally {
      retrieveSpy.mockRestore();
    }
  });

  it("refreshes the live Stripe projection when plan metadata is missing", async () => {
    const brandId = await createTestBrand("Billing Status Missing Plan Metadata Brand");
    const stripeSubscriptionId = "sub_billing_status_missing_plan";

    await addBrandMember(ownerId, brandId);
    await setBrandBillingState({
      brandId,
      stripeSubscriptionId,
      updatedAt: new Date().toISOString(),
      planType: null,
      billingInterval: null,
    });

    const stripe = getStripeClient();
    const retrieveSpy = spyOn(
      stripe.subscriptions,
      "retrieve",
    ).mockRejectedValue(new Error("Stripe API unavailable"));

    try {
      const caller = appRouter.createCaller(
        createMockContext({
          userId: ownerId,
          userEmail: ownerEmail,
          brandId,
          role: "owner",
        }),
      );

      await expect(caller.brand.billing.getStatus()).rejects.toMatchObject({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to refresh billing status",
      });
      expect(retrieveSpy).toHaveBeenCalled();
    } finally {
      retrieveSpy.mockRestore();
    }
  });
});
