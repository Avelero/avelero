import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandBilling, brandLifecycle, brandPlan, brands } from "../../schema";

export interface BrandAccessSnapshotRow {
  brandId: string;
  lifecycle: {
    phase: "demo" | "trial" | "expired" | "active" | "past_due" | "suspended" | "cancelled";
    trialEndsAt: string | null;
  } | null;
  billing: {
    billingAccessOverride: "none" | "temporary_allow" | "temporary_block";
    billingOverrideExpiresAt: string | null;
  } | null;
  plan: {
    skuAnnualLimit: number | null;
    skuOnboardingLimit: number | null;
    skuLimitOverride: number | null;
    skusCreatedThisYear: number;
    skusCreatedOnboarding: number;
  } | null;
}

type LifecyclePhase = NonNullable<BrandAccessSnapshotRow["lifecycle"]>["phase"];
type BillingOverride =
  NonNullable<BrandAccessSnapshotRow["billing"]>["billingAccessOverride"];

export async function getBrandAccessSnapshot(
  db: Database,
  brandId: string,
): Promise<BrandAccessSnapshotRow> {
  const [row] = await db
    .select({
      brandId: brands.id,
      lifecyclePhase: brandLifecycle.phase,
      lifecycleTrialEndsAt: brandLifecycle.trialEndsAt,
      billingAccessOverride: brandBilling.billingAccessOverride,
      billingOverrideExpiresAt: brandBilling.billingOverrideExpiresAt,
      skuAnnualLimit: brandPlan.skuAnnualLimit,
      skuOnboardingLimit: brandPlan.skuOnboardingLimit,
      skuLimitOverride: brandPlan.skuLimitOverride,
      skusCreatedThisYear: brandPlan.skusCreatedThisYear,
      skusCreatedOnboarding: brandPlan.skusCreatedOnboarding,
    })
    .from(brands)
    .leftJoin(brandLifecycle, eq(brandLifecycle.brandId, brands.id))
    .leftJoin(brandBilling, eq(brandBilling.brandId, brands.id))
    .leftJoin(brandPlan, eq(brandPlan.brandId, brands.id))
    .where(eq(brands.id, brandId))
    .limit(1);

  if (!row) {
    return {
      brandId,
      lifecycle: null,
      billing: null,
      plan: null,
    };
  }

  return {
    brandId: row.brandId,
    lifecycle: row.lifecyclePhase
      ? {
          phase: row.lifecyclePhase as LifecyclePhase,
          trialEndsAt: row.lifecycleTrialEndsAt,
        }
      : null,
    billing: row.billingAccessOverride
      ? {
          billingAccessOverride: row.billingAccessOverride as BillingOverride,
          billingOverrideExpiresAt: row.billingOverrideExpiresAt,
        }
      : null,
    plan:
      row.skuAnnualLimit !== null ||
      row.skuOnboardingLimit !== null ||
      row.skuLimitOverride !== null ||
      row.skusCreatedThisYear !== null ||
      row.skusCreatedOnboarding !== null
        ? {
            skuAnnualLimit: row.skuAnnualLimit,
            skuOnboardingLimit: row.skuOnboardingLimit,
            skuLimitOverride: row.skuLimitOverride,
            skusCreatedThisYear: row.skusCreatedThisYear ?? 0,
            skusCreatedOnboarding: row.skusCreatedOnboarding ?? 0,
          }
        : null,
  };
}
