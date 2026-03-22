/**
 * Integration tests for brand and credit access policy enforcement.
 */
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/routers/_app";
import { ACCESS_ERROR_TOKENS } from "../../../src/utils/errors";

type BrandPhase =
  | "demo"
  | "trial"
  | "expired"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

type BrandRole = "owner" | "member" | "avelero";

/**
 * Creates an authenticated tRPC context for access-policy tests.
 */
function createMockContext(params: {
  brandId: string;
  userId: string;
  userEmail: string;
  role: BrandRole;
}): AuthenticatedTRPCContext & { brandId: string; role: BrandRole } {
  return {
    user: {
      id: params.userId,
      email: params.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: params.brandId,
    role: params.role,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Seeds lifecycle, plan, and billing rows for access-policy scenarios.
 */
async function setBrandSubscriptionState(params: {
  brandId: string;
  phase: BrandPhase;
  trialEndsAt?: string | null;
  trialStartedAt?: string | null;
  billingMode?: "stripe_checkout" | "stripe_invoice" | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  pastDueSince?: string | null;
  pendingCancellation?: boolean;
  billingOverride?: "none" | "temporary_allow" | "temporary_block";
  billingOverrideExpiresAt?: string | null;
  billingInterval?: "quarterly" | "yearly" | null;
  totalCredits?: number;
}) {
  const now = new Date().toISOString();

  await testDb
    .insert(schema.brandLifecycle)
    .values({
      brandId: params.brandId,
      phase: params.phase,
      phaseChangedAt: now,
      trialEndsAt: params.trialEndsAt ?? null,
      trialStartedAt: params.trialStartedAt ?? null,
      cancelledAt: params.phase === "cancelled" ? now : null,
      hardDeleteAfter: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandLifecycle.brandId,
      set: {
        phase: params.phase,
        phaseChangedAt: now,
        trialEndsAt: params.trialEndsAt ?? null,
        trialStartedAt: params.trialStartedAt ?? null,
        cancelledAt: params.phase === "cancelled" ? now : null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandBilling)
    .values({
      brandId: params.brandId,
      billingMode: params.billingMode ?? null,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      planCurrency: "EUR",
      customPriceCents: null,
      currentPeriodStart: params.currentPeriodStart ?? null,
      currentPeriodEnd: params.currentPeriodEnd ?? null,
      pastDueSince: params.pastDueSince ?? null,
      pendingCancellation: params.pendingCancellation ?? false,
      billingAccessOverride: params.billingOverride ?? "none",
      billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandBilling.brandId,
      set: {
        billingMode: params.billingMode ?? null,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        currentPeriodStart: params.currentPeriodStart ?? null,
        currentPeriodEnd: params.currentPeriodEnd ?? null,
        pastDueSince: params.pastDueSince ?? null,
        pendingCancellation: params.pendingCancellation ?? false,
        billingAccessOverride: params.billingOverride ?? "none",
        billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      planType: "starter",
      billingInterval: params.billingInterval ?? "quarterly",
      totalCredits: params.totalCredits ?? 50,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        planType: "starter",
        billingInterval: params.billingInterval ?? "quarterly",
        totalCredits: params.totalCredits ?? 50,
        updatedAt: now,
      },
    });
}

/**
 * Asserts that a promise fails with the expected access-policy token.
 */
async function expectToken(promise: Promise<unknown>, token: string) {
  await expect(promise).rejects.toMatchObject({
    message: expect.stringContaining(token),
  });
}

describe("Access policy enforcement (tRPC)", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    brandId = await createTestBrand("Access Policy Brand");
    userEmail = `access-${Math.random().toString(36).slice(2, 8)}@example.com`;
    userId = await createTestUser(userEmail);

    await testDb.insert(schema.brandMembers).values({
      brandId,
      userId,
      role: "owner",
    });

    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      totalCredits: 500,
    });
  });

  it("payment_required allows reads and blocks writes", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "expired",
      totalCredits: 500,
    });

    const caller = appRouter.createCaller(
      createMockContext({ brandId, userId, userEmail, role: "owner" }),
    );

    await expect(caller.summary.productStatus()).resolves.toBeDefined();
    await expect(caller.products.list({})).resolves.toBeDefined();

    await expectToken(
      caller.brand.collections.create({
        name: "Blocked in payment_required",
        filter: {},
      }),
      ACCESS_ERROR_TOKENS.PAYMENT_REQUIRED,
    );
  });

  it("past_due allows reads and keeps writes enabled during grace", async () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    await setBrandSubscriptionState({
      brandId,
      phase: "past_due",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_grace",
      stripeSubscriptionId: "sub_grace",
      currentPeriodStart: thirtyDaysAgo.toISOString(),
      currentPeriodEnd: thirtyDaysAgo.toISOString(),
      pastDueSince: threeDaysAgo.toISOString(),
      totalCredits: 500,
    });

    const caller = appRouter.createCaller(
      createMockContext({ brandId, userId, userEmail, role: "owner" }),
    );

    await expect(caller.summary.productStatus()).resolves.toBeDefined();
    await expect(caller.products.list({})).resolves.toBeDefined();
    await expect(
      caller.brand.collections.create({
        name: "Allowed in past_due",
        filter: {},
      }),
    ).resolves.toBeDefined();
  });

  it("temporary_block overrides normal active access", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      billingOverride: "temporary_block",
      totalCredits: 500,
    });

    const caller = appRouter.createCaller(
      createMockContext({ brandId, userId, userEmail, role: "owner" }),
    );

    await expect(caller.summary.productStatus()).resolves.toBeDefined();
    await expectToken(
      caller.brand.collections.create({
        name: "Blocked by temporary override",
        filter: {},
      }),
      ACCESS_ERROR_TOKENS.TEMPORARY_BLOCKED,
    );
  });
});
