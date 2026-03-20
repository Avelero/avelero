/**
 * Covers SKU access decisions across trial, onboarding, annual, and uninitialized states.
 */
import { describe, expect, it } from "bun:test";
import { resolveSkuAccessDecision } from "../../../src/lib/access-policy/resolve-sku-access-decision";
import type {
  BrandAccessSnapshot,
  ResolvedBrandAccessDecision,
} from "../../../src/lib/access-policy/types";

type BrandAccessSnapshotOverrides = {
  brandId?: string;
  lifecycle?: Partial<NonNullable<BrandAccessSnapshot["lifecycle"]>>;
  billing?: Partial<NonNullable<BrandAccessSnapshot["billing"]>>;
  plan?: Partial<NonNullable<BrandAccessSnapshot["plan"]>>;
};

/**
 * Returns an explicit override, including null, when the caller provided the key.
 */
function resolveOverride<T extends object, K extends keyof T>(
  overrides: Partial<T> | undefined,
  key: K,
  fallback: T[K],
): T[K] {
  // Preserve explicit null test overrides instead of treating them as missing.
  if (overrides && Object.prototype.hasOwnProperty.call(overrides, key)) {
    return overrides[key] as T[K];
  }

  return fallback;
}

/**
 * Builds a brand access snapshot with targeted nested overrides.
 */
function buildSnapshot(
  overrides: BrandAccessSnapshotOverrides = {},
): BrandAccessSnapshot {
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
    skuAnnualLimit: 100,
    skuOnboardingLimit: null,
    skuLimitOverride: null,
    firstPaidStartedAt: "2024-01-01T00:00:00.000Z",
    annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
    skuCountAtYearStart: 0,
    skuCountAtOnboardingStart: 0,
  };
  const base: BrandAccessSnapshot = {
    brandId: "brand-1",
    lifecycle: baseLifecycle,
    billing: baseBilling,
    plan: basePlan,
  };
  const lifecycle: NonNullable<BrandAccessSnapshot["lifecycle"]> = {
    phase: resolveOverride(overrides.lifecycle, "phase", baseLifecycle.phase),
    trialStartedAt: resolveOverride(
      overrides.lifecycle,
      "trialStartedAt",
      baseLifecycle.trialStartedAt,
    ),
    trialEndsAt: resolveOverride(
      overrides.lifecycle,
      "trialEndsAt",
      baseLifecycle.trialEndsAt,
    ),
  };
  const billing: NonNullable<BrandAccessSnapshot["billing"]> = {
    billingMode: resolveOverride(
      overrides.billing,
      "billingMode",
      baseBilling.billingMode,
    ),
    stripeCustomerId: resolveOverride(
      overrides.billing,
      "stripeCustomerId",
      baseBilling.stripeCustomerId,
    ),
    stripeSubscriptionId: resolveOverride(
      overrides.billing,
      "stripeSubscriptionId",
      baseBilling.stripeSubscriptionId,
    ),
    billingAccessOverride: resolveOverride(
      overrides.billing,
      "billingAccessOverride",
      baseBilling.billingAccessOverride,
    ),
    billingOverrideExpiresAt: resolveOverride(
      overrides.billing,
      "billingOverrideExpiresAt",
      baseBilling.billingOverrideExpiresAt,
    ),
    currentPeriodStart: resolveOverride(
      overrides.billing,
      "currentPeriodStart",
      baseBilling.currentPeriodStart,
    ),
    currentPeriodEnd: resolveOverride(
      overrides.billing,
      "currentPeriodEnd",
      baseBilling.currentPeriodEnd,
    ),
    pastDueSince: resolveOverride(
      overrides.billing,
      "pastDueSince",
      baseBilling.pastDueSince,
    ),
    pendingCancellation: resolveOverride(
      overrides.billing,
      "pendingCancellation",
      baseBilling.pendingCancellation,
    ),
  };
  const plan: NonNullable<BrandAccessSnapshot["plan"]> = {
    skuAnnualLimit: resolveOverride(
      overrides.plan,
      "skuAnnualLimit",
      basePlan.skuAnnualLimit,
    ),
    skuOnboardingLimit: resolveOverride(
      overrides.plan,
      "skuOnboardingLimit",
      basePlan.skuOnboardingLimit,
    ),
    skuLimitOverride: resolveOverride(
      overrides.plan,
      "skuLimitOverride",
      basePlan.skuLimitOverride,
    ),
    firstPaidStartedAt: resolveOverride(
      overrides.plan,
      "firstPaidStartedAt",
      basePlan.firstPaidStartedAt,
    ),
    annualUsageAnchorAt: resolveOverride(
      overrides.plan,
      "annualUsageAnchorAt",
      basePlan.annualUsageAnchorAt,
    ),
    skuCountAtYearStart: resolveOverride(
      overrides.plan,
      "skuCountAtYearStart",
      basePlan.skuCountAtYearStart,
    ),
    skuCountAtOnboardingStart: resolveOverride(
      overrides.plan,
      "skuCountAtOnboardingStart",
      basePlan.skuCountAtOnboardingStart,
    ),
  };

  return {
    brandId: overrides.brandId ?? base.brandId,
    lifecycle,
    billing,
    plan,
  };
}

/**
 * Builds a resolved brand access decision with minimal targeted overrides.
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
  it("applies 79%, 80%, and 100% thresholds", () => {
    const brandAccess = buildBrandAccess();

    const seventyNine = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 79,
      trialStartedAt: null,
    });
    expect(seventyNine.status).toBe("allowed");

    const eighty = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 80,
      trialStartedAt: null,
    });
    expect(eighty.status).toBe("warning");

    const hundred = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 100,
      trialStartedAt: null,
    });
    expect(hundred.status).toBe("blocked");
  });

  it("enforces the trial cap", () => {
    const trialAccess = buildBrandAccess({
      decision: "trial_active",
      phase: "trial",
    });

    const nearCap = resolveSkuAccessDecision({
      brandAccess: trialAccess,
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "trial",
          trialStartedAt: "2025-03-10T00:00:00.000Z",
          trialEndsAt: "2026-03-10T00:00:00.000Z",
        },
        plan: {
          skuAnnualLimit: null,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skuCountAtYearStart: null,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 49,
    });

    expect(nearCap.status).toBe("warning");
    expect(nearCap.remainingCreateBudget).toBe(1);

    const atCap = resolveSkuAccessDecision({
      brandAccess: trialAccess,
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "trial",
          trialStartedAt: "2025-03-10T00:00:00.000Z",
          trialEndsAt: "2026-03-10T00:00:00.000Z",
        },
        plan: {
          skuAnnualLimit: null,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skuCountAtYearStart: null,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 50,
    });

    expect(atCap.status).toBe("blocked");
    expect(atCap.remainingCreateBudget).toBe(0);
  });

  it("still enforces the trial cap while the lifecycle phase remains trial", () => {
    const elevatedTrialAccess = buildBrandAccess({
      decision: "full_access",
      phase: "trial",
    });

    const result = resolveSkuAccessDecision({
      brandAccess: elevatedTrialAccess,
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "trial",
          trialStartedAt: "2025-03-10T00:00:00.000Z",
          trialEndsAt: "2026-03-10T00:00:00.000Z",
        },
        billing: {
          billingMode: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          billingAccessOverride: "temporary_allow",
          billingOverrideExpiresAt: null,
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pastDueSince: null,
          pendingCancellation: false,
        },
        plan: {
          skuAnnualLimit: null,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skuCountAtYearStart: null,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 50,
    });

    expect(result.status).toBe("blocked");
    expect(result.remainingCreateBudget).toBe(0);
  });

  it("blocks when intended create count exceeds remaining budget", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 10,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 2,
      currentNonGhostSkuCount: 9,
      trialStartedAt: null,
    });

    expect(result.status).toBe("blocked");
    expect(result.wouldExceedIntendedCreateCount).toBe(true);
  });

  it("forces blocked status when brand write access is blocked", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess({
        decision: "payment_required",
        capabilities: {
          canReadBrandData: true,
          canWriteBrandData: false,
          canCreateSkus: false,
        },
      }),
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 0,
      trialStartedAt: null,
    });

    expect(result.status).toBe("blocked");
  });

  it("ignores onboarding limits after the onboarding year ends", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "active",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        plan: {
          skuAnnualLimit: 500,
          skuOnboardingLimit: 10,
          skuLimitOverride: null,
          firstPaidStartedAt: "2024-01-01T00:00:00.000Z",
          annualUsageAnchorAt: "2024-01-01T00:00:00.000Z",
          skuCountAtYearStart: 90,
          skuCountAtOnboardingStart: 0,
        },
      }),
      intendedCreateCount: 1,
      currentNonGhostSkuCount: 100,
    });

    expect(result.onboarding.limit).toBeNull();
    expect(result.status).toBe("allowed");
  });

  it("uses the provided evaluation date for onboarding checks", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "active",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        plan: {
          skuAnnualLimit: 500,
          skuOnboardingLimit: 10,
          skuLimitOverride: null,
          firstPaidStartedAt: "2025-03-17T12:00:00.000Z",
          annualUsageAnchorAt: "2025-03-17T12:00:00.000Z",
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: 2,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 5,
      evaluationDate: "2026-03-17T11:59:59.000Z",
    });

    expect(result.onboarding.limit).toBe(10);
    expect(result.onboarding.used).toBe(5);
  });

  it("does not enforce annual or onboarding limits before anchors are initialized", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "active",
          trialStartedAt: "2025-03-01T00:00:00.000Z",
          trialEndsAt: null,
        },
        plan: {
          skuAnnualLimit: 500,
          skuOnboardingLimit: 2_500,
          skuLimitOverride: null,
          firstPaidStartedAt: null,
          annualUsageAnchorAt: null,
          skuCountAtYearStart: null,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 200,
      currentNonGhostSkuCount: 1_250,
    });

    expect(result.annual.limit).toBeNull();
    expect(result.annual.used).toBe(0);
    expect(result.onboarding.limit).toBeNull();
    expect(result.onboarding.used).toBe(0);
    expect(result.remainingCreateBudget).toBeNull();
    expect(result.status).toBe("allowed");
  });
});
