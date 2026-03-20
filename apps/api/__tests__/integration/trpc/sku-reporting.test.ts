/**
 * Integration Tests: SKU reporting routes.
 *
 * Verifies customer billing and platform-admin reporting return derived SKU
 * usage while still counting every live variant row on the ghost rollout path.
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "@v1/db/queries";
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
 * Seeds lifecycle, plan, and billing rows for SKU reporting scenarios.
 */
async function setBrandReportingState(params: {
  brandId: string;
  phase?: "demo" | "trial" | "expired" | "active" | "past_due" | "suspended" | "cancelled";
  trialStartedAt?: string | null;
  trialEndsAt?: string | null;
  firstPaidStartedAt?: string | null;
  annualUsageAnchorAt?: string | null;
  skuAnnualLimit?: number | null;
  skuOnboardingLimit?: number | null;
  skuLimitOverride?: number | null;
  skuCountAtYearStart?: number | null;
  skuCountAtOnboardingStart?: number | null;
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
      skuAnnualLimit: params.skuAnnualLimit ?? null,
      skuOnboardingLimit: params.skuOnboardingLimit ?? null,
      skuLimitOverride: params.skuLimitOverride ?? null,
      firstPaidStartedAt: params.firstPaidStartedAt ?? null,
      annualUsageAnchorAt: params.annualUsageAnchorAt ?? null,
      skuYearStart: null,
      skuCountAtYearStart: params.skuCountAtYearStart ?? null,
      skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        skuAnnualLimit: params.skuAnnualLimit ?? null,
        skuOnboardingLimit: params.skuOnboardingLimit ?? null,
        skuLimitOverride: params.skuLimitOverride ?? null,
        firstPaidStartedAt: params.firstPaidStartedAt ?? null,
        annualUsageAnchorAt: params.annualUsageAnchorAt ?? null,
        skuYearStart: null,
        skuCountAtYearStart: params.skuCountAtYearStart ?? null,
        skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
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

/**
 * Marks an existing variant as a legacy ghost row without removing it.
 */
async function markVariantAsLegacyGhost(variantId: string) {
  await testDb
    .update(schema.productVariants)
    .set({ isGhost: true })
    .where(eq(schema.productVariants.id, variantId));
}

/**
 * Sets a deterministic created-at timestamp for a variant row.
 */
async function setVariantCreatedAt(variantId: string, createdAt: string) {
  await testDb
    .update(schema.productVariants)
    .set({ createdAt })
    .where(eq(schema.productVariants.id, variantId));
}

describe("SKU reporting routes", () => {
  it("brand.billing.getStatus returns active onboarding usage from variants inside the current window", async () => {
    const brandId = await createTestBrand("Billing Usage Brand");
    await addBrandMember(ownerId, brandId);
    const firstPaidStartedAt = new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await setBrandReportingState({
      brandId,
      phase: "active",
      firstPaidStartedAt,
      annualUsageAnchorAt: firstPaidStartedAt,
      skuAnnualLimit: 10,
      skuOnboardingLimit: 9,
      skuCountAtYearStart: 1,
      skuCountAtOnboardingStart: 2,
    });

    const product = await createTestProduct(brandId, {
      productHandle: `billing-usage-${Math.random().toString(36).slice(2, 8)}`,
    });
    const beforeWindow = await createTestVariant(product.id, {
      sku: "billing-old",
    });
    const insideWindowA = await createTestVariant(product.id, { sku: "billing-1" });
    const insideWindowB = await createTestVariant(product.id, { sku: "billing-2" });
    const legacyGhost = await createTestVariant(product.id, { sku: "billing-3" });
    await setVariantCreatedAt(
      beforeWindow.id,
      new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(insideWindowA.id, firstPaidStartedAt);
    await setVariantCreatedAt(
      insideWindowB.id,
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await markVariantAsLegacyGhost(legacyGhost.id);

    const caller = appRouter.createCaller(
      createMockContext({
        userId: ownerId,
        userEmail: ownerEmail,
        brandId,
        role: "owner",
      }),
    );

    const result = await caller.brand.billing.getStatus();

    expect(result.active_sku_budget.kind).toBe("onboarding");
    expect(result.active_sku_budget.used).toBe(3);
    expect(result.skus_created_this_year).toBe(0);
    expect(result.skus_created_onboarding).toBe(3);
  });

  it("platformAdmin.brands.get returns derived annual usage for the active window", async () => {
    const brandId = await createTestBrand("Admin Detail Brand");
    await addBrandMember(ownerId, brandId);
    const firstPaidStartedAt = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await setBrandReportingState({
      brandId,
      phase: "active",
      firstPaidStartedAt,
      annualUsageAnchorAt: firstPaidStartedAt,
      skuAnnualLimit: 10,
      skuOnboardingLimit: 9,
      skuCountAtYearStart: 1,
      skuCountAtOnboardingStart: 2,
    });

    const product = await createTestProduct(brandId, {
      productHandle: `admin-detail-${Math.random().toString(36).slice(2, 8)}`,
    });
    const beforeWindow = await createTestVariant(product.id, { sku: "detail-old" });
    const insideWindowA = await createTestVariant(product.id, { sku: "detail-1" });
    const insideWindowB = await createTestVariant(product.id, { sku: "detail-2" });
    const legacyGhost = await createTestVariant(product.id, { sku: "detail-3" });
    await setVariantCreatedAt(
      beforeWindow.id,
      new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      insideWindowA.id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      insideWindowB.id,
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await markVariantAsLegacyGhost(legacyGhost.id);

    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminId,
        userEmail: adminEmail,
      }),
    );

    const result = await caller.platformAdmin.brands.get({ brand_id: brandId });

    expect(result.plan.skus_created_this_year).toBe(3);
    expect(result.plan.skus_created_onboarding).toBe(0);
    expect(result.usage.annual).toEqual({
      used: 3,
      limit: 10,
      remaining: 7,
    });
    expect(result.usage.onboarding).toEqual({
      used: 0,
      limit: null,
      remaining: null,
    });
  });

  it("platformAdmin.brands.list sorts by active-window usage and keeps uninitialized limits open", async () => {
    const highUsageBrandId = await createTestBrand("High Usage Brand");
    const lowUsageBrandId = await createTestBrand("Low Usage Brand");
    const uninitializedBrandId = await createTestBrand("Uninitialized Brand");
    const annualUsageAnchorAt = new Date(
      Date.now() - 2 * 365 * 24 * 60 * 60 * 1000,
    ).toISOString();

    await setBrandReportingState({
      brandId: highUsageBrandId,
      firstPaidStartedAt: annualUsageAnchorAt,
      annualUsageAnchorAt,
      skuAnnualLimit: 10,
      skuCountAtYearStart: 0,
    });
    await setBrandReportingState({
      brandId: lowUsageBrandId,
      firstPaidStartedAt: annualUsageAnchorAt,
      annualUsageAnchorAt,
      skuAnnualLimit: 10,
      skuCountAtYearStart: 2,
    });
    await setBrandReportingState({
      brandId: uninitializedBrandId,
      skuAnnualLimit: 10,
      skuCountAtYearStart: null,
    });

    const highUsageProduct = await createTestProduct(highUsageBrandId, {
      productHandle: `high-usage-${Math.random().toString(36).slice(2, 8)}`,
    });
    const highOld = await createTestVariant(highUsageProduct.id, { sku: "high-old" });
    const highA = await createTestVariant(highUsageProduct.id, { sku: "high-1" });
    const highB = await createTestVariant(highUsageProduct.id, { sku: "high-2" });
    const highGhost = await createTestVariant(highUsageProduct.id, {
      sku: "high-3",
    });
    await setVariantCreatedAt(
      highOld.id,
      new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      highA.id,
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      highB.id,
      new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await markVariantAsLegacyGhost(highGhost.id);

    const lowUsageProduct = await createTestProduct(lowUsageBrandId, {
      productHandle: `low-usage-${Math.random().toString(36).slice(2, 8)}`,
    });
    const lowOldA = await createTestVariant(lowUsageProduct.id, { sku: "low-old-a" });
    const lowOldB = await createTestVariant(lowUsageProduct.id, { sku: "low-old-b" });
    const lowCurrent = await createTestVariant(lowUsageProduct.id, { sku: "low-1" });
    await setVariantCreatedAt(
      lowOldA.id,
      new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      lowOldB.id,
      new Date(Date.now() - 450 * 24 * 60 * 60 * 1000).toISOString(),
    );
    await setVariantCreatedAt(
      lowCurrent.id,
      new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    );

    const uninitializedProduct = await createTestProduct(uninitializedBrandId, {
      productHandle: `uninitialized-${Math.random().toString(36).slice(2, 8)}`,
    });
    await createTestVariant(uninitializedProduct.id, { sku: "uninit-1" });
    await createTestVariant(uninitializedProduct.id, { sku: "uninit-2" });

    const caller = appRouter.createCaller(
      createMockContext({
        userId: adminId,
        userEmail: adminEmail,
      }),
    );

    const result = await caller.platformAdmin.brands.list({
      sort_by: "sku_usage",
      sort_dir: "desc",
      page: 1,
      page_size: 10,
    });

    // Filter to only the brands created in this test case, preserving the
    // sort order returned by the endpoint.  Other test cases in this file
    // also create brands that appear in the unfiltered list.
    const testBrandIds = new Set([highUsageBrandId, lowUsageBrandId, uninitializedBrandId]);
    const filtered = result.items.filter((item) => testBrandIds.has(item.id));

    expect(filtered.map((item) => item.id)).toEqual([
      highUsageBrandId,
      lowUsageBrandId,
      uninitializedBrandId,
    ]);
    expect(filtered[0]?.sku_usage).toEqual({
      used: 3,
      limit: 10,
    });
    expect(filtered[1]?.sku_usage).toEqual({
      used: 1,
      limit: 10,
    });
    expect(filtered[2]?.sku_usage).toEqual({
      used: 0,
      limit: null,
    });
  });
});
