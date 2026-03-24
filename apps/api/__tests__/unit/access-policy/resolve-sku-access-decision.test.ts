/**
 * Covers credit-based SKU access decisions across demo, trial, and paid brands.
 */
import { describe, expect, it } from "bun:test";
import { resolveSkuAccessDecision } from "../../../src/lib/access-policy/resolve-sku-access-decision";
import type {
  BrandAccessSnapshot,
  ResolvedBrandAccessDecision,
} from "../../../src/lib/access-policy/types";

/**
 * Builds a minimal access snapshot for credit-budget tests.
 */
function buildSnapshot(
  overrides: Partial<BrandAccessSnapshot> = {},
): BrandAccessSnapshot {
  // Split nested overrides so partial fixtures keep the base nested defaults.
  const {
    lifecycle: lifecycleOverride,
    billing: billingOverride,
    plan: planOverride,
    ...topLevelOverrides
  } = overrides;
  const baseLifecycle: NonNullable<BrandAccessSnapshot["lifecycle"]> = {
    phase: "active",
    trialStartedAt: null,
    trialEndsAt: null,
  };
  const baseBilling: NonNullable<BrandAccessSnapshot["billing"]> = {
    billingMode: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    billingAccessOverride: "none",
    billingOverrideExpiresAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    pastDueSince: null,
    pendingCancellation: false,
  };
  const basePlan: NonNullable<BrandAccessSnapshot["plan"]> = {
    totalCredits: 500,
    onboardingDiscountUsed: false,
    variantGlobalCap: null,
  };

  return {
    brandId: "brand-1",
    lifecycle:
      lifecycleOverride === null
        ? null
        : { ...baseLifecycle, ...(lifecycleOverride ?? {}) },
    billing:
      billingOverride === null
        ? null
        : { ...baseBilling, ...(billingOverride ?? {}) },
    plan:
      planOverride === null
        ? null
        : { ...basePlan, ...(planOverride ?? {}) },
    ...topLevelOverrides,
  };
}

/**
 * Builds a resolved brand access decision with minimal overrides.
 */
function buildBrandAccess(
  overrides: Partial<ResolvedBrandAccessDecision> = {},
): ResolvedBrandAccessDecision {
  return {
    decision: "full_access",
    capabilities: {
      canReadBrandData: true,
      canWriteBrandData: true,
      canCreateSkus: true,
    },
    overlay: "none",
    banner: "none",
    phase: "active",
    trialEndsAt: null,
    currentPeriodStart: null,
    currentPeriodEnd: null,
    pastDueSince: null,
    pendingCancellation: false,
    graceEndsAt: null,
    ...overrides,
  };
}

describe("resolveSkuAccessDecision", () => {
  it("applies 79%, 80%, and 100% thresholds to the credit balance", () => {
    const brandAccess = buildBrandAccess();

    const seventyNine = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({ plan: { totalCredits: 500, onboardingDiscountUsed: false } }),
      intendedPublishCount: 0,
      currentPublishUsageCount: 399,
    });
    expect(seventyNine.status).toBe("allowed");

    const eighty = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({ plan: { totalCredits: 500, onboardingDiscountUsed: false } }),
      intendedPublishCount: 0,
      currentPublishUsageCount: 400,
    });
    expect(eighty.status).toBe("warning");

    const hundred = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({ plan: { totalCredits: 500, onboardingDiscountUsed: false } }),
      intendedPublishCount: 0,
      currentPublishUsageCount: 500,
    });
    expect(hundred.status).toBe("blocked");
  });

  it("blocks publishes that would exceed the remaining credit balance", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        plan: { totalCredits: 500, onboardingDiscountUsed: false },
      }),
      intendedPublishCount: 51,
      currentPublishUsageCount: 450,
    });

    expect(result.status).toBe("blocked");
    expect(result.remainingPublishBudget).toBe(50);
    expect(result.wouldExceedIntendedPublishCount).toBe(true);
  });

  it("uses the same credit path for trial brands", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess({ phase: "trial" }),
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "trial",
          trialStartedAt: "2026-03-01T00:00:00.000Z",
          trialEndsAt: "2026-04-01T00:00:00.000Z",
        },
        plan: { totalCredits: 50, onboardingDiscountUsed: false },
      }),
      intendedPublishCount: 0,
      currentPublishUsageCount: 30,
    });

    expect(result.activeBudget.kind).toBe("credits");
    expect(result.activeBudget.phase).toBe("trial");
    expect(result.activeBudget.totalCredits).toBe(50);
    expect(result.activeBudget.remaining).toBe(20);
    expect(result.status).toBe("allowed");
  });

  it("preserves nested plan defaults when applying partial overrides", () => {
    const snapshot = buildSnapshot({
      plan: { totalCredits: 500, onboardingDiscountUsed: false },
    });

    expect(snapshot.plan).toEqual({
      totalCredits: 500,
      onboardingDiscountUsed: false,
      variantGlobalCap: null,
    });
  });
});
