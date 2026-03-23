/**
 * Integration coverage for credit-based brand SKU usage queries.
 */
import "../../setup";

import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  countBrandSkus,
  countPublishedPassports,
  deriveSkuBudget,
  enforcePublishCapacity,
  enforceVariantGlobalCap,
  getBrandAccessSnapshot,
  PublishLimitExceededError,
} from "../../../src/queries/brand";
import * as schema from "../../../src/schema";
import {
  createTestBrand,
  createTestProduct,
  createTestVariant,
  testDb,
} from "../../../src/testing";

/**
 * Upserts the brand plan row used by the credit-budget tests.
 */
async function upsertBrandPlan(params: {
  brandId: string;
  totalCredits?: number;
  onboardingDiscountUsed?: boolean;
  variantGlobalCap?: number | null;
}) {
  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      totalCredits: params.totalCredits ?? 50,
      onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
      variantGlobalCap: params.variantGlobalCap ?? null,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        totalCredits: params.totalCredits ?? 50,
        onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
        variantGlobalCap: params.variantGlobalCap ?? null,
      },
    });
}

describe("brand sku usage queries", () => {
  it("counts all variants for the requested brand", async () => {
    const brandA = await createTestBrand("SKU Count Brand A");
    const brandB = await createTestBrand("SKU Count Brand B");
    const productA = await createTestProduct(brandA);
    const productB = await createTestProduct(brandB);

    await createTestVariant(productA.id, { sku: "A-1" });
    await createTestVariant(productA.id, { sku: "A-2" });
    await createTestVariant(productA.id, { sku: "A-3" });
    await createTestVariant(productB.id, { sku: "B-1" });

    expect(await countBrandSkus(testDb, brandA)).toBe(3);
    expect(await countBrandSkus(testDb, brandB)).toBe(1);
  });

  it("counts all published variants against the cumulative credit balance", async () => {
    const brandId = await createTestBrand("Published Credit Count Brand");
    const publishedProduct = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });
    const unpublishedProduct = await createTestProduct(brandId, {
      status: "unpublished",
      publishedAt: null,
    });

    await createTestVariant(publishedProduct.id, { sku: "PUBLISHED-1" });
    await createTestVariant(publishedProduct.id, { sku: "PUBLISHED-2" });
    await createTestVariant(unpublishedProduct.id, { sku: "DRAFT-1" });

    expect(await countPublishedPassports(testDb, brandId)).toBe(2);
  });

  it("enforces publish capacity from total credits", async () => {
    const brandId = await createTestBrand("Publish Capacity Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });

    await createTestVariant(product.id, { sku: "CAPACITY-1" });
    await createTestVariant(product.id, { sku: "CAPACITY-2" });
    await upsertBrandPlan({ brandId, totalCredits: 3 });

    await expect(enforcePublishCapacity(testDb, brandId, 1)).resolves.toEqual({
      used: 2,
      limit: 3,
      remaining: 1,
      budgetKind: "credits",
    });

    await expect(
      enforcePublishCapacity(testDb, brandId, 2),
    ).rejects.toBeInstanceOf(PublishLimitExceededError);
  });

  it("allows zero-create global cap checks when the brand is already over cap", async () => {
    const brandId = await createTestBrand("Variant Cap Usage Brand");
    const product = await createTestProduct(brandId);

    await createTestVariant(product.id, { sku: "CAP-1" });
    await createTestVariant(product.id, { sku: "CAP-2" });
    await upsertBrandPlan({
      brandId,
      variantGlobalCap: 1,
    });

    const result = await enforceVariantGlobalCap(testDb, brandId, 0);

    expect(result.total).toBe(2);
    expect(result.cap).toBe(1);
    expect(result.remaining).toBe(0);
  });

  it("derives a single credit budget from the access snapshot", async () => {
    const brandId = await createTestBrand("Derived Credit Budget Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });

    await createTestVariant(product.id, { sku: "BUDGET-1" });
    await createTestVariant(product.id, { sku: "BUDGET-2" });
    await createTestVariant(product.id, { sku: "BUDGET-3" });
    await testDb
      .insert(schema.brandLifecycle)
      .values({ brandId, phase: "demo", phaseChangedAt: new Date().toISOString() })
      .onConflictDoNothing();
    await upsertBrandPlan({
      brandId,
      totalCredits: 125,
      onboardingDiscountUsed: true,
    });

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const derivedBudget = deriveSkuBudget({
      snapshot,
      currentPublishUsageCount: 3,
    });

    expect(derivedBudget.activeBudget.kind).toBe("credits");
    expect(derivedBudget.activeBudget.phase).toBe("demo");
    expect(derivedBudget.activeBudget.totalCredits).toBe(125);
    expect(derivedBudget.activeBudget.publishedCount).toBe(3);
    expect(derivedBudget.activeBudget.remaining).toBe(122);

    const [storedPlan] = await testDb
      .select({
        totalCredits: schema.brandPlan.totalCredits,
        onboardingDiscountUsed: schema.brandPlan.onboardingDiscountUsed,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    expect(storedPlan?.totalCredits).toBe(125);
    expect(storedPlan?.onboardingDiscountUsed).toBe(true);
  });

  it("treats subscription renewals as additive credit grants instead of resetting usage", async () => {
    const brandId = await createTestBrand("Additive Renewal Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });

    await createTestVariant(product.id, { sku: "RENEWAL-1" });
    await createTestVariant(product.id, { sku: "RENEWAL-2" });
    await createTestVariant(product.id, { sku: "RENEWAL-3" });
    await upsertBrandPlan({
      brandId,
      totalCredits: 450,
    });

    const beforeRenewal = await deriveSkuBudget({
      snapshot: await getBrandAccessSnapshot(testDb, brandId),
      currentPublishUsageCount: 3,
    });

    await upsertBrandPlan({
      brandId,
      totalCredits: 850,
    });

    const afterRenewal = await deriveSkuBudget({
      snapshot: await getBrandAccessSnapshot(testDb, brandId),
      currentPublishUsageCount: 3,
    });

    expect(beforeRenewal.activeBudget.totalCredits).toBe(450);
    expect(beforeRenewal.activeBudget.remaining).toBe(447);
    expect(afterRenewal.activeBudget.totalCredits).toBe(850);
    expect(afterRenewal.activeBudget.remaining).toBe(847);
  });

  it("keeps purchased top-up credits available after later subscription renewals", async () => {
    const brandId = await createTestBrand("Top-up Persistence Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });

    await createTestVariant(product.id, { sku: "TOPUP-1" });
    await createTestVariant(product.id, { sku: "TOPUP-2" });
    await upsertBrandPlan({
      brandId,
      totalCredits: 700,
    });

    const afterTopup = await deriveSkuBudget({
      snapshot: await getBrandAccessSnapshot(testDb, brandId),
      currentPublishUsageCount: 2,
    });

    await upsertBrandPlan({
      brandId,
      totalCredits: 1_100,
    });

    const afterRenewal = await deriveSkuBudget({
      snapshot: await getBrandAccessSnapshot(testDb, brandId),
      currentPublishUsageCount: 2,
    });

    expect(afterTopup.activeBudget.totalCredits).toBe(700);
    expect(afterTopup.activeBudget.remaining).toBe(698);
    expect(afterRenewal.activeBudget.totalCredits).toBe(1_100);
    expect(afterRenewal.activeBudget.remaining).toBe(1_098);
  });

  it("restores publish headroom when a published product is unpublished", async () => {
    const brandId = await createTestBrand("Unpublish Restores Headroom Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-03-01T00:00:00.000Z",
    });

    await createTestVariant(product.id, { sku: "UNPUBLISH-1" });
    await createTestVariant(product.id, { sku: "UNPUBLISH-2" });
    await upsertBrandPlan({
      brandId,
      totalCredits: 2,
    });

    await expect(
      enforcePublishCapacity(testDb, brandId, 1),
    ).rejects.toBeInstanceOf(PublishLimitExceededError);

    await testDb
      .update(schema.products)
      .set({
        status: "unpublished",
        publishedAt: null,
      })
      .where(eq(schema.products.id, product.id));

    await expect(enforcePublishCapacity(testDb, brandId, 1)).resolves.toEqual({
      used: 0,
      limit: 2,
      remaining: 2,
      budgetKind: "credits",
    });
  });
});
