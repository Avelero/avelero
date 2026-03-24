/**
 * Integration tests for credit-based billing and admin usage reporting.
 */
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestProduct,
  createTestUser,
  createTestVariant,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { appRouter } from "../../../src/trpc/routers/_app";

type BrandRole = "owner" | "member" | "avelero";

let ownerId: string;
let ownerEmail: string;
let adminId: string;
let adminEmail: string;

beforeEach(async () => {
  ownerEmail = `owner-${Math.random().toString(36).slice(2, 8)}@example.com`;
  ownerId = await createTestUser(ownerEmail);
  adminEmail = `admin-${Math.random().toString(36).slice(2, 8)}@example.com`;
  adminId = await createTestUser(adminEmail);
  await allowPlatformAdmin(adminId, adminEmail);
});

/**
 * Creates an authenticated tRPC context for integration tests.
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
 * Adds a user to the platform-admin allowlist for router tests.
 */
async function allowPlatformAdmin(userId: string, email: string) {
  await testDb.insert(schema.platformAdminAllowlist).values({
    email,
    userId,
  });
}

/**
 * Seeds lifecycle, plan, and billing rows for credit-reporting scenarios.
 */
async function setBrandReportingState(params: {
  brandId: string;
  phase?: "demo" | "trial" | "expired" | "active" | "past_due" | "suspended" | "cancelled";
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  planType?: "starter" | "growth" | "scale" | "enterprise" | null;
  billingInterval?: "quarterly" | "yearly" | null;
  totalCredits?: number;
  onboardingDiscountUsed?: boolean;
}) {
  const now = new Date().toISOString();

  await testDb
    .insert(schema.brandLifecycle)
    .values({
      brandId: params.brandId,
      phase: params.phase ?? "active",
      phaseChangedAt: now,
      trialStartedAt: params.trialStartedAt ?? null,
      trialEndsAt: params.trialEndsAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandLifecycle.brandId,
      set: {
        phase: params.phase ?? "active",
        phaseChangedAt: now,
        trialStartedAt: params.trialStartedAt ?? null,
        trialEndsAt: params.trialEndsAt ?? null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      planType: params.planType ?? "starter",
      billingInterval: params.billingInterval ?? "quarterly",
      totalCredits: params.totalCredits ?? 50,
      onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        planType: params.planType ?? "starter",
        billingInterval: params.billingInterval ?? "quarterly",
        totalCredits: params.totalCredits ?? 50,
        onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandBilling)
    .values({
      brandId: params.brandId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandBilling.brandId,
      set: {
        updatedAt: now,
      },
    });
}

describe("credit reporting routes", () => {
  it("brand.billing.getStatus returns total, published, and remaining credits", async () => {
    const brandId = await createTestBrand("Billing Usage Brand");
    await addBrandMember(ownerId, brandId);
    await setBrandReportingState({
      brandId,
      phase: "active",
      planType: "starter",
      billingInterval: "quarterly",
      totalCredits: 125,
    });

    const publishedProduct = await createTestProduct(brandId, {
      productHandle: `billing-usage-${Math.random().toString(36).slice(2, 8)}`,
      status: "published",
      publishedAt: new Date().toISOString(),
    });
    await createTestVariant(publishedProduct.id, { sku: "billing-1" });
    await createTestVariant(publishedProduct.id, { sku: "billing-2" });
    await createTestVariant(publishedProduct.id, { sku: "billing-3" });

    const caller = appRouter.createCaller(
      createMockContext({
        userId: ownerId,
        userEmail: ownerEmail,
        brandId,
        role: "owner",
      }),
    );

    const result = await caller.brand.billing.getStatus();

    expect(result.total_credits).toBe(125);
    expect(result.published_count).toBe(3);
    expect(result.remaining_credits).toBe(122);
    expect(result.utilization).toBeCloseTo(3 / 125);
  });

  it("platformAdmin.brands.get returns credit-based plan and usage fields", async () => {
    const brandId = await createTestBrand("Admin Detail Brand");
    await addBrandMember(ownerId, brandId);
    await setBrandReportingState({
      brandId,
      phase: "active",
      planType: "growth",
      billingInterval: "yearly",
      totalCredits: 2_000,
      onboardingDiscountUsed: true,
    });

    const publishedProduct = await createTestProduct(brandId, {
      productHandle: `admin-usage-${Math.random().toString(36).slice(2, 8)}`,
      status: "published",
      publishedAt: new Date().toISOString(),
    });
    await createTestVariant(publishedProduct.id, { sku: "admin-1" });
    await createTestVariant(publishedProduct.id, { sku: "admin-2" });

    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminId,
        userEmail: adminEmail,
        role: "avelero",
      }),
    );

    const result = await caller.platformAdmin.brands.get({ brand_id: brandId });

    expect(result.plan.total_credits).toBe(2_000);
    expect(result.plan.published_count).toBe(2);
    expect(result.plan.remaining_credits).toBe(1_998);
    expect(result.plan.onboarding_discount_used).toBe(true);
    expect(result.usage.credits).toEqual({
      total: 2_000,
      published: 2,
      remaining: 1_998,
      utilization: 2 / 2_000,
    });
  });
});
