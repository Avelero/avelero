/**
 * Integration coverage for brand SKU usage queries and anchor-derived window helpers.
 */
import "../../setup";

import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  countBrandSkus,
  countPublishedPassportsInActiveWindow,
  enforceVariantGlobalCap,
  getBrandAccessSnapshot,
  isOnboardingYear,
  lazyExpireOnboardingLimitIfNeeded,
  lazyResetAnnualPeriodIfNeeded,
  resolveActiveSkuWindow,
} from "../../../src/queries/brand";
import * as schema from "../../../src/schema";
import {
  createTestBrand,
  createTestProduct,
  createTestVariant,
  testDb,
} from "../../../src/testing";

/**
 * Formats a date-like value as `YYYY-MM-DD` for stable assertions.
 */
function formatDateOnly(
  value: Date | string | null | undefined,
): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  return value.toISOString().slice(0, 10);
}

/**
 * Creates a UTC date shifted by whole years from the current moment.
 */
function yearsFromNow(yearOffset: number): Date {
  const date = new Date();
  return new Date(
    Date.UTC(
      date.getUTCFullYear() + yearOffset,
      date.getUTCMonth(),
      date.getUTCDate(),
    ),
  );
}

/**
 * Creates a UTC date shifted by whole days from the current moment.
 */
function daysFromNow(dayOffset: number): Date {
  const date = new Date();
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate() + dayOffset,
    ),
  );
}

/**
 * Upserts a brand plan row for the current test brand.
 */
async function upsertBrandPlan(params: {
  brandId: string;
  firstPaidStartedAt?: string | null;
  annualUsageAnchorAt?: string | null;
  skuYearStart?: Date | null;
  skuCountAtYearStart?: number | null;
  skuOnboardingLimit?: number | null;
  skuCountAtOnboardingStart?: number | null;
  skuAnnualLimit?: number | null;
  variantGlobalCap?: number | null;
}) {
  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      firstPaidStartedAt: params.firstPaidStartedAt ?? null,
      annualUsageAnchorAt: params.annualUsageAnchorAt ?? null,
      skuYearStart: params.skuYearStart ?? null,
      skuCountAtYearStart: params.skuCountAtYearStart ?? null,
      skuAnnualLimit: params.skuAnnualLimit ?? null,
      skuOnboardingLimit: params.skuOnboardingLimit ?? null,
      skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
      variantGlobalCap: params.variantGlobalCap ?? null,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        firstPaidStartedAt: params.firstPaidStartedAt ?? null,
        annualUsageAnchorAt: params.annualUsageAnchorAt ?? null,
        skuYearStart: params.skuYearStart ?? null,
        skuCountAtYearStart: params.skuCountAtYearStart ?? null,
        skuAnnualLimit: params.skuAnnualLimit ?? null,
        skuOnboardingLimit: params.skuOnboardingLimit ?? null,
        skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
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

  it("preserves an explicit null publishedAt for published test products", async () => {
    const brandId = await createTestBrand("Published Null Fixture Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      publishedAt: null,
    });

    const [storedProduct] = await testDb
      .select({
        status: schema.products.status,
        publishedAt: schema.products.publishedAt,
      })
      .from(schema.products)
      .where(eq(schema.products.id, product.id))
      .limit(1);

    expect(storedProduct?.status).toBe("published");
    expect(storedProduct?.publishedAt).toBeNull();
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

  it("derives annual windows from the paid anchor without mutating legacy snapshots", async () => {
    const brandId = await createTestBrand("Annual Reset Brand");
    const initialYearStart = yearsFromNow(-2);
    const annualUsageAnchorAt = "2024-01-15T00:00:00.000Z";
    const evaluationDate = "2026-03-20T12:00:00.000Z";
    const beforeWindowProduct = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2025-12-31T23:59:59.000Z",
    });
    const insideWindowProduct = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-01-15T00:00:00.000Z",
    });
    const unpublishedProduct = await createTestProduct(brandId, {
      status: "unpublished",
      publishedAt: null,
    });

    await createTestVariant(beforeWindowProduct.id, { sku: "RESET-1" });
    await createTestVariant(insideWindowProduct.id, { sku: "RESET-2" });
    await createTestVariant(insideWindowProduct.id, { sku: "RESET-3" });
    await createTestVariant(unpublishedProduct.id, { sku: "RESET-4" });

    await upsertBrandPlan({
      brandId,
      annualUsageAnchorAt,
      skuAnnualLimit: 500,
      skuYearStart: initialYearStart,
      skuCountAtYearStart: 1,
    });

    const result = await lazyResetAnnualPeriodIfNeeded(
      testDb,
      brandId,
      evaluationDate,
    );

    const [plan] = await testDb
      .select({
        skuYearStart: schema.brandPlan.skuYearStart,
        skuCountAtYearStart: schema.brandPlan.skuCountAtYearStart,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const activeWindow = resolveActiveSkuWindow({
      snapshot,
      evaluationDate,
    });
    const usageCount = await countPublishedPassportsInActiveWindow(
      testDb,
      brandId,
      activeWindow,
    );

    expect(result.wasReset).toBe(false);
    expect(plan?.skuCountAtYearStart).toBe(1);
    expect(formatDateOnly(plan?.skuYearStart)).toBe(
      formatDateOnly(initialYearStart),
    );
    expect(activeWindow.kind).toBe("annual");
    expect(activeWindow.windowStartAt).toBe("2026-01-15T00:00:00.000Z");
    expect(activeWindow.windowEndAt).toBe("2027-01-15T00:00:00.000Z");
    expect(usageCount).toBe(2);
  });

  it("does not reset the annual period before the first anniversary", async () => {
    const brandId = await createTestBrand("Annual Noop Brand");
    const initialYearStart = daysFromNow(-180);

    await upsertBrandPlan({
      brandId,
      skuYearStart: initialYearStart,
      skuCountAtYearStart: 7,
    });

    const result = await lazyResetAnnualPeriodIfNeeded(testDb, brandId);

    const [plan] = await testDb
      .select({
        skuYearStart: schema.brandPlan.skuYearStart,
        skuCountAtYearStart: schema.brandPlan.skuCountAtYearStart,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    expect(result.wasReset).toBe(false);
    expect(plan?.skuCountAtYearStart).toBe(7);
    expect(formatDateOnly(plan?.skuYearStart)).toBe(
      formatDateOnly(initialYearStart),
    );
  });

  it("derives onboarding state from first paid start without expiring stored limits", async () => {
    const brandId = await createTestBrand("Onboarding Expiry Brand");
    const firstPaidStartedAt = "2026-02-15T00:00:00.000Z";
    const evaluationDate = "2026-03-20T12:00:00.000Z";
    const beforeWindowProduct = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-02-14T23:59:59.000Z",
    });
    const insideWindowProduct = await createTestProduct(brandId, {
      status: "published",
      publishedAt: "2026-02-15T00:00:00.000Z",
    });
    const scheduledProduct = await createTestProduct(brandId, {
      status: "scheduled",
      publishedAt: null,
    });

    await createTestVariant(beforeWindowProduct.id, { sku: "ONBOARD-1" });
    await createTestVariant(insideWindowProduct.id, { sku: "ONBOARD-2" });
    await createTestVariant(insideWindowProduct.id, { sku: "ONBOARD-3" });
    await createTestVariant(scheduledProduct.id, { sku: "ONBOARD-4" });

    await upsertBrandPlan({
      brandId,
      firstPaidStartedAt,
      skuOnboardingLimit: 2500,
      skuCountAtOnboardingStart: 10,
    });

    expect(
      isOnboardingYear(firstPaidStartedAt, "2027-02-14T23:59:59.000Z"),
    ).toBe(true);
    expect(
      isOnboardingYear(firstPaidStartedAt, "2027-02-15T00:00:00.000Z"),
    ).toBe(false);

    const result = await lazyExpireOnboardingLimitIfNeeded(
      testDb,
      brandId,
      firstPaidStartedAt,
      evaluationDate,
    );

    const [plan] = await testDb
      .select({
        skuOnboardingLimit: schema.brandPlan.skuOnboardingLimit,
        skuCountAtOnboardingStart: schema.brandPlan.skuCountAtOnboardingStart,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const activeWindow = resolveActiveSkuWindow({
      snapshot,
      evaluationDate,
    });
    const usageCount = await countPublishedPassportsInActiveWindow(
      testDb,
      brandId,
      activeWindow,
    );

    expect(result.wasExpired).toBe(false);
    expect(plan?.skuOnboardingLimit).toBe(2500);
    expect(plan?.skuCountAtOnboardingStart).toBe(10);
    expect(activeWindow.kind).toBe("onboarding");
    expect(activeWindow.windowStartAt).toBe("2026-02-15T00:00:00.000Z");
    expect(activeWindow.windowEndAt).toBe("2027-02-15T00:00:00.000Z");
    expect(usageCount).toBe(2);
  });

  it("accepts an explicit evaluation date for onboarding-year checks", () => {
    const firstPaidStartedAt = "2025-03-17T12:00:00.000Z";

    expect(
      isOnboardingYear(firstPaidStartedAt, "2026-03-17T11:59:59.000Z"),
    ).toBe(true);
    expect(
      isOnboardingYear(firstPaidStartedAt, "2026-03-17T12:00:00.000Z"),
    ).toBe(false);
  });
});
