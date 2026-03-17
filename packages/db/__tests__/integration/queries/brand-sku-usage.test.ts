/**
 * Integration coverage for brand SKU usage queries and lazy period helpers.
 */
import "../../setup";

import { describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
  countBrandSkus,
  isOnboardingYear,
  lazyExpireOnboardingLimitIfNeeded,
  lazyResetAnnualPeriodIfNeeded,
} from "../../../src/queries/brand/sku-usage";
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
function formatDateOnly(value: Date | string | null | undefined): string | null {
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
 * Computes the most recent annual boundary at or before today.
 */
function latestAnniversary(start: Date, today: Date): Date {
  let anniversary = new Date(start.getTime());

  while (
    Date.UTC(
      anniversary.getUTCFullYear() + 1,
      anniversary.getUTCMonth(),
      anniversary.getUTCDate(),
    ) <=
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  ) {
    anniversary = new Date(
      Date.UTC(
        anniversary.getUTCFullYear() + 1,
        anniversary.getUTCMonth(),
        anniversary.getUTCDate(),
      ),
    );
  }

  return anniversary;
}

/**
 * Upserts a brand plan row for the current test brand.
 */
async function upsertBrandPlan(params: {
  brandId: string;
  skuYearStart?: Date | null;
  skuCountAtYearStart?: number | null;
  skuOnboardingLimit?: number | null;
  skuCountAtOnboardingStart?: number | null;
}) {
  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      skuYearStart: params.skuYearStart ?? null,
      skuCountAtYearStart: params.skuCountAtYearStart ?? null,
      skuOnboardingLimit: params.skuOnboardingLimit ?? null,
      skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        skuYearStart: params.skuYearStart ?? null,
        skuCountAtYearStart: params.skuCountAtYearStart ?? null,
        skuOnboardingLimit: params.skuOnboardingLimit ?? null,
        skuCountAtOnboardingStart: params.skuCountAtOnboardingStart ?? null,
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

  it("lazily resets the annual snapshot to the live SKU count", async () => {
    const brandId = await createTestBrand("Annual Reset Brand");
    const product = await createTestProduct(brandId);
    const initialYearStart = yearsFromNow(-2);
    const today = new Date();

    await createTestVariant(product.id, { sku: "RESET-1" });
    await createTestVariant(product.id, { sku: "RESET-2" });
    await createTestVariant(product.id, { sku: "RESET-3" });

    await upsertBrandPlan({
      brandId,
      skuYearStart: initialYearStart,
      skuCountAtYearStart: 1,
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

    expect(result.wasReset).toBe(true);
    expect(plan?.skuCountAtYearStart).toBe(3);
    expect(formatDateOnly(plan?.skuYearStart)).toBe(
      formatDateOnly(latestAnniversary(initialYearStart, today)),
    );
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

  it("expires onboarding limits after the first year and reports onboarding state", async () => {
    const brandId = await createTestBrand("Onboarding Expiry Brand");
    const expiredTrialStartedAt = yearsFromNow(-2).toISOString();
    const recentTrialStartedAt = daysFromNow(-30).toISOString();

    await upsertBrandPlan({
      brandId,
      skuOnboardingLimit: 2500,
      skuCountAtOnboardingStart: 10,
    });

    expect(isOnboardingYear(recentTrialStartedAt)).toBe(true);
    expect(isOnboardingYear(expiredTrialStartedAt)).toBe(false);

    const result = await lazyExpireOnboardingLimitIfNeeded(
      testDb,
      brandId,
      expiredTrialStartedAt,
    );

    const [plan] = await testDb
      .select({
        skuOnboardingLimit: schema.brandPlan.skuOnboardingLimit,
        skuCountAtOnboardingStart: schema.brandPlan.skuCountAtOnboardingStart,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    expect(result.wasExpired).toBe(true);
    expect(plan?.skuOnboardingLimit).toBeNull();
    expect(plan?.skuCountAtOnboardingStart).toBe(10);
  });

  it("accepts an explicit evaluation date for onboarding-year checks", () => {
    const trialStartedAt = "2025-03-17T12:00:00.000Z";

    expect(
      isOnboardingYear(trialStartedAt, "2026-03-17T11:59:59.000Z"),
    ).toBe(true);
    expect(
      isOnboardingYear(trialStartedAt, "2026-03-17T12:00:00.000Z"),
    ).toBe(false);
  });
});
