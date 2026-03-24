/**
 * Live Stripe tests for Checkout session creation and reuse.
 */
import { describe, expect, it, beforeAll } from "bun:test";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import {
  addBrandMember,
  createMockContext,
  setBrandSubscriptionState,
} from "../helpers/billing";
import { TIER_CONFIG } from "../../src/lib/stripe/config";
import { appRouter } from "../../src/trpc/routers/_app";
import {
  createLiveBillingBrand,
  createLiveStripeCleanupTracker,
  ensureLiveStripePriceCatalog,
  getLiveStripeClient,
  listCheckoutSessionLineItems,
  listOpenCheckoutSessions,
} from "./helpers/live-billing";

/**
 * Reads the linked Stripe customer ID for a brand.
 */
async function getBrandStripeCustomerId(brandId: string): Promise<string | null> {
  const [billing] = await testDb
    .select({
      stripeCustomerId: schema.brandBilling.stripeCustomerId,
    })
    .from(schema.brandBilling)
    .where(eq(schema.brandBilling.brandId, brandId))
    .limit(1);

  return billing?.stripeCustomerId ?? null;
}

beforeAll(async () => {
  // Fail fast if the configured sandbox price catalog is not usable.
  await ensureLiveStripePriceCatalog();
});

describe("live Stripe Checkout sessions", () => {
  it("creates a real Checkout session with matching metadata and line items", async () => {
    const stripe = getLiveStripeClient();
    const cleanup = createLiveStripeCleanupTracker(stripe);
    const harness = await createLiveBillingBrand({
      namePrefix: "Checkout Success",
    });

    try {
      const result = await harness.caller.brand.billing.createCheckoutSession({
        tier: "growth",
        interval: "quarterly",
        include_impact: true,
      });

      expect(result.url).toContain("stripe.com");

      const stripeCustomerId = await getBrandStripeCustomerId(harness.brandId);
      expect(stripeCustomerId).toBeTruthy();
      cleanup.trackCustomer(stripeCustomerId!);

      const openSessions = await listOpenCheckoutSessions({
        stripe,
        customerId: stripeCustomerId!,
      });
      const session = openSessions.find(
        (candidate) =>
          candidate.client_reference_id === harness.brandId &&
          candidate.metadata?.plan_type === "growth" &&
          candidate.metadata?.billing_interval === "quarterly" &&
          candidate.metadata?.include_impact === "true",
      );

      expect(session).toBeDefined();
      expect(session?.url).toBe(result.url);

      const lineItems = await listCheckoutSessionLineItems({
        stripe,
        sessionId: session!.id,
      });
      const priceIds = lineItems
        .map((item) =>
          typeof item.price === "string" ? item.price : item.price?.id ?? null,
        )
        .filter((value): value is string => !!value)
        .sort();

      expect(priceIds).toEqual(
        [
          TIER_CONFIG.growth.prices.quarterly.avelero,
          TIER_CONFIG.growth.prices.quarterly.impact,
        ].sort(),
      );
    } finally {
      await cleanup.cleanup();
    }
  });

  it("reuses matching sessions and expires stale brand-scoped ones", async () => {
    const stripe = getLiveStripeClient();
    const cleanup = createLiveStripeCleanupTracker(stripe);
    const harness = await createLiveBillingBrand({
      namePrefix: "Checkout Reuse",
    });

    try {
      const first = await harness.caller.brand.billing.createCheckoutSession({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      });

      const stripeCustomerId = await getBrandStripeCustomerId(harness.brandId);
      expect(stripeCustomerId).toBeTruthy();
      cleanup.trackCustomer(stripeCustomerId!);

      const [firstSession] = await listOpenCheckoutSessions({
        stripe,
        customerId: stripeCustomerId!,
      });
      expect(firstSession).toBeDefined();

      const reused = await harness.caller.brand.billing.createCheckoutSession({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      });

      expect(reused.url).toBe(first.url);

      const differentPlan =
        await harness.caller.brand.billing.createCheckoutSession({
          tier: "starter",
          interval: "yearly",
          include_impact: false,
        });

      expect(differentPlan.url).not.toBe(first.url);

      const refreshedFirst = await stripe.checkout.sessions.retrieve(
        firstSession!.id,
      );
      const openSessions = await listOpenCheckoutSessions({
        stripe,
        customerId: stripeCustomerId!,
      });

      expect(refreshedFirst.status).toBe("expired");
      expect(openSessions).toHaveLength(1);
      expect(openSessions[0]?.url).toBe(differentPlan.url);
      expect(openSessions[0]?.metadata?.billing_interval).toBe("yearly");
    } finally {
      await cleanup.cleanup();
    }
  });

  it("blocks checkout when a Stripe subscription already exists", async () => {
    const harness = await createLiveBillingBrand({
      namePrefix: "Checkout Existing Sub",
      phase: "active",
      billingMode: "stripe_checkout",
      planType: "starter",
      billingInterval: "quarterly",
    });

    await setBrandSubscriptionState({
      brandId: harness.brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_existing_live_checkout",
      stripeSubscriptionId: "sub_existing_live_checkout",
      currentPeriodStart: "2026-01-01T00:00:00.000Z",
      currentPeriodEnd: "2026-02-01T00:00:00.000Z",
    });

    await expect(
      harness.caller.brand.billing.createCheckoutSession({
        tier: "growth",
        interval: "quarterly",
        include_impact: false,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("already has an active"),
    });
  });

  it("blocks checkout for enterprise invoice billing and missing billing state", async () => {
    const enterpriseHarness = await createLiveBillingBrand({
      namePrefix: "Checkout Enterprise",
      phase: "active",
      planType: "enterprise",
      billingMode: "stripe_invoice",
      billingInterval: "yearly",
    });

    await expect(
      enterpriseHarness.caller.brand.billing.createCheckoutSession({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("enterprise"),
    });

    const ownerEmail = `checkout-missing-${crypto.randomUUID().slice(0, 8)}@example.com`;
    const ownerId = await createTestUser(ownerEmail);
    const brandId = await createTestBrand("Checkout Missing Billing State");
    await addBrandMember(ownerId, brandId);

    const caller = appRouter.createCaller(
      createMockContext({
        userId: ownerId,
        userEmail: ownerEmail,
        brandId,
        role: "owner",
      }),
    );

    await expect(
      caller.brand.billing.createCheckoutSession({
        tier: "starter",
        interval: "quarterly",
        include_impact: false,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: expect.stringContaining("not initialized"),
    });
  });
});
