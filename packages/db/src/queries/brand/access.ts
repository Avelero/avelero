/**
 * Queries the lifecycle, billing, and plan snapshot used by the access policy resolver.
 */
import { eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { brandBilling, brandLifecycle, brandPlan, brands } from "../../schema";

export interface BrandAccessSnapshotRow {
  brandId: string;
  lifecycle: {
    phase:
      | "demo"
      | "trial"
      | "expired"
      | "active"
      | "past_due"
      | "suspended"
      | "cancelled";
    trialStartedAt: string | null;
    trialEndsAt: string | null;
  } | null;
  billing: {
    billingMode: "stripe_checkout" | "stripe_invoice" | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    billingAccessOverride: "none" | "temporary_allow" | "temporary_block";
    billingOverrideExpiresAt: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    pastDueSince: string | null;
    pendingCancellation: boolean;
  } | null;
  plan: {
    totalCredits: number;
    onboardingDiscountUsed: boolean;
    variantGlobalCap?: number | null;
  } | null;
}

type LifecyclePhase = NonNullable<BrandAccessSnapshotRow["lifecycle"]>["phase"];
type BillingOverride = NonNullable<
  BrandAccessSnapshotRow["billing"]
>["billingAccessOverride"];
type BillingMode = NonNullable<BrandAccessSnapshotRow["billing"]>["billingMode"];

/**
 * Loads the access-policy snapshot for a brand in a single query.
 */
export async function getBrandAccessSnapshot(
  db: DatabaseOrTransaction,
  brandId: string,
): Promise<BrandAccessSnapshotRow> {
  const [row] = await db
    .select({
      brandId: brands.id,
      lifecyclePhase: brandLifecycle.phase,
      lifecycleTrialStartedAt: brandLifecycle.trialStartedAt,
      lifecycleTrialEndsAt: brandLifecycle.trialEndsAt,
      billingMode: brandBilling.billingMode,
      stripeCustomerId: brandBilling.stripeCustomerId,
      stripeSubscriptionId: brandBilling.stripeSubscriptionId,
      billingAccessOverride: brandBilling.billingAccessOverride,
      billingOverrideExpiresAt: brandBilling.billingOverrideExpiresAt,
      billingCurrentPeriodStart: brandBilling.currentPeriodStart,
      billingCurrentPeriodEnd: brandBilling.currentPeriodEnd,
      billingPastDueSince: brandBilling.pastDueSince,
      billingPendingCancellation: brandBilling.pendingCancellation,
      totalCredits: brandPlan.totalCredits,
      onboardingDiscountUsed: brandPlan.onboardingDiscountUsed,
      variantGlobalCap: brandPlan.variantGlobalCap,
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
          trialStartedAt: row.lifecycleTrialStartedAt,
          trialEndsAt: row.lifecycleTrialEndsAt,
        }
      : null,
    billing: row.billingAccessOverride
      ? {
          billingMode: row.billingMode as BillingMode,
          stripeCustomerId: row.stripeCustomerId,
          stripeSubscriptionId: row.stripeSubscriptionId,
          billingAccessOverride: row.billingAccessOverride as BillingOverride,
          billingOverrideExpiresAt: row.billingOverrideExpiresAt,
          currentPeriodStart: row.billingCurrentPeriodStart,
          currentPeriodEnd: row.billingCurrentPeriodEnd,
          pastDueSince: row.billingPastDueSince,
          pendingCancellation: row.billingPendingCancellation ?? false,
        }
      : null,
    plan:
      row.totalCredits !== null ||
      row.onboardingDiscountUsed !== null ||
      row.variantGlobalCap !== null
        ? {
            totalCredits: row.totalCredits ?? 0,
            onboardingDiscountUsed: row.onboardingDiscountUsed ?? false,
            variantGlobalCap: row.variantGlobalCap,
          }
        : null,
  };
}
