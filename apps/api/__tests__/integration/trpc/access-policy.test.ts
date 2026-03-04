// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestProduct,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/routers/_app";
import { ACCESS_ERROR_TOKENS } from "../../../src/utils/errors";

type BrandPhase = "demo" | "trial" | "expired" | "active" | "past_due" | "suspended" | "cancelled";

type BrandRole = "owner" | "member" | "avelero";

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

async function setBrandSubscriptionState(params: {
  brandId: string;
  phase: BrandPhase;
  trialEndsAt?: string | null;
  billingOverride?: "none" | "temporary_allow" | "temporary_block";
  billingOverrideExpiresAt?: string | null;
  skuAnnualLimit?: number | null;
  skuOnboardingLimit?: number | null;
  skuLimitOverride?: number | null;
  skusCreatedThisYear?: number;
  skusCreatedOnboarding?: number;
}) {
  const now = new Date().toISOString();

  await testDb
    .insert(schema.brandLifecycle)
    .values({
      brandId: params.brandId,
      phase: params.phase,
      phaseChangedAt: now,
      trialEndsAt: params.trialEndsAt ?? null,
      trialStartedAt: null,
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
        cancelledAt: params.phase === "cancelled" ? now : null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandBilling)
    .values({
      brandId: params.brandId,
      billingMode: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planCurrency: "EUR",
      customMonthlyPriceCents: null,
      billingAccessOverride: params.billingOverride ?? "none",
      billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandBilling.brandId,
      set: {
        billingAccessOverride: params.billingOverride ?? "none",
        billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      planType: null,
      planSelectedAt: null,
      skuAnnualLimit: params.skuAnnualLimit ?? null,
      skuOnboardingLimit: params.skuOnboardingLimit ?? null,
      skuLimitOverride: params.skuLimitOverride ?? null,
      skuYearStart: null,
      skusCreatedThisYear: params.skusCreatedThisYear ?? 0,
      skusCreatedOnboarding: params.skusCreatedOnboarding ?? 0,
      maxSeats: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        skuAnnualLimit: params.skuAnnualLimit ?? null,
        skuOnboardingLimit: params.skuOnboardingLimit ?? null,
        skuLimitOverride: params.skuLimitOverride ?? null,
        skusCreatedThisYear: params.skusCreatedThisYear ?? 0,
        skusCreatedOnboarding: params.skusCreatedOnboarding ?? 0,
        updatedAt: now,
      },
    });
}

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
      skuAnnualLimit: 500,
      skusCreatedThisYear: 0,
      skusCreatedOnboarding: 0,
    });
  });

  it("payment_required allows reads and blocks writes", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "expired",
      skuAnnualLimit: 500,
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

  it("past_due allows reads and blocks writes", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "past_due",
      skuAnnualLimit: 500,
    });

    const caller = appRouter.createCaller(
      createMockContext({ brandId, userId, userEmail, role: "owner" }),
    );

    await expect(caller.summary.productStatus()).resolves.toBeDefined();
    await expect(caller.products.list({})).resolves.toBeDefined();

    await expectToken(
      caller.brand.collections.create({
        name: "Blocked in past_due",
        filter: {},
      }),
      ACCESS_ERROR_TOKENS.PAST_DUE_READ_ONLY,
    );
  });

  it("suspended and cancelled block reads and writes", async () => {
    const cases: Array<{
      phase: BrandPhase;
      token: string;
    }> = [
      {
        phase: "suspended",
        token: ACCESS_ERROR_TOKENS.SUSPENDED,
      },
      {
        phase: "cancelled",
        token: ACCESS_ERROR_TOKENS.CANCELLED,
      },
    ];

    for (const testCase of cases) {
      await setBrandSubscriptionState({
        brandId,
        phase: testCase.phase,
        skuAnnualLimit: 500,
      });

      const caller = appRouter.createCaller(
        createMockContext({ brandId, userId, userEmail, role: "owner" }),
      );

      await expectToken(caller.summary.productStatus(), testCase.token);
      await expectToken(
        caller.brand.collections.create({
          name: `Blocked in ${testCase.phase}`,
          filter: {},
        }),
        testCase.token,
      );
    }
  });

  it("avelero bypass keeps reads and writes available across blocked states", async () => {
    const aveleroUserEmail = `avelero-${Math.random().toString(36).slice(2, 8)}@example.com`;
    const aveleroUserId = await createTestUser(aveleroUserEmail);

    await testDb.insert(schema.brandMembers).values({
      brandId,
      userId: aveleroUserId,
      role: "avelero",
    });

    const blockedPhases: BrandPhase[] = [
      "expired",
      "past_due",
      "suspended",
      "cancelled",
    ];

    for (const phase of blockedPhases) {
      await setBrandSubscriptionState({
        brandId,
        phase,
        skuAnnualLimit: 500,
      });

      const caller = appRouter.createCaller(
        createMockContext({
          brandId,
          userId: aveleroUserId,
          userEmail: aveleroUserEmail,
          role: "avelero",
        }),
      );

      await expect(caller.summary.productStatus()).resolves.toBeDefined();
      await expect(
        caller.brand.collections.create({
          name: `Avelero write ${phase}`,
          filter: { phase },
        }),
      ).resolves.toBeDefined();
    }
  });

  it("blocks SKU mutation with ACCESS_SKU_LIMIT_REACHED when over budget", async () => {
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      skuAnnualLimit: 1,
      skusCreatedThisYear: 1,
      skusCreatedOnboarding: 0,
    });

    const product = await createTestProduct(brandId, {
      productHandle: `sku-limit-${Math.random().toString(36).slice(2, 8)}`,
    });

    const caller = appRouter.createCaller(
      createMockContext({ brandId, userId, userEmail, role: "owner" }),
    );

    await expectToken(
      caller.products.variants.create({
        productHandle: product.productHandle,
        attributeValueIds: [],
      }),
      ACCESS_ERROR_TOKENS.SKU_LIMIT_REACHED,
    );
  });
});
