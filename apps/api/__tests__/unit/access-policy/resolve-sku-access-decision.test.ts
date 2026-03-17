import { describe, expect, it } from "bun:test";
import { resolveSkuAccessDecision } from "../../../src/lib/access-policy/resolve-sku-access-decision";
import type {
  BrandAccessSnapshot,
  ResolvedBrandAccessDecision,
} from "../../../src/lib/access-policy/types";

function buildSnapshot(
  overrides: Partial<BrandAccessSnapshot> = {},
): BrandAccessSnapshot {
  return {
    brandId: "brand-1",
    lifecycle: {
      phase: "active",
      trialStartedAt: null,
      trialEndsAt: null,
    },
    billing: {
      billingMode: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      billingAccessOverride: "none",
      billingOverrideExpiresAt: null,
      currentPeriodStart: null,
      currentPeriodEnd: null,
      pastDueSince: null,
      pendingCancellation: false,
    },
    plan: {
      skuAnnualLimit: 100,
      skuOnboardingLimit: null,
      skuLimitOverride: null,
      skuCountAtYearStart: 0,
      skuCountAtOnboardingStart: 0,
    },
    ...overrides,
  };
}

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

  it("enforces trial universal cap", () => {
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
      currentNonGhostSkuCount: 49_999,
      trialStartedAt: "2025-03-10T00:00:00.000Z",
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
      currentNonGhostSkuCount: 50_000,
      trialStartedAt: "2025-03-10T00:00:00.000Z",
    });

    expect(atCap.status).toBe("blocked");
    expect(atCap.remainingCreateBudget).toBe(0);
  });

  it("blocks when intended create count exceeds remaining budget", () => {
    const result = resolveSkuAccessDecision({
      brandAccess: buildBrandAccess(),
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 10,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
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
          trialStartedAt: "2024-01-01T00:00:00.000Z",
          trialEndsAt: null,
        },
        plan: {
          skuAnnualLimit: 500,
          skuOnboardingLimit: 10,
          skuLimitOverride: null,
          skuCountAtYearStart: 90,
          skuCountAtOnboardingStart: 0,
        },
      }),
      intendedCreateCount: 1,
      currentNonGhostSkuCount: 100,
      trialStartedAt: "2024-01-01T00:00:00.000Z",
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
          trialStartedAt: "2025-03-17T12:00:00.000Z",
          trialEndsAt: null,
        },
        plan: {
          skuAnnualLimit: 500,
          skuOnboardingLimit: 10,
          skuLimitOverride: null,
          skuCountAtYearStart: 0,
          skuCountAtOnboardingStart: 2,
        },
      }),
      intendedCreateCount: 0,
      currentNonGhostSkuCount: 5,
      trialStartedAt: "2025-03-17T12:00:00.000Z",
      evaluationDate: "2026-03-17T11:59:59.000Z",
    });

    expect(result.onboarding.limit).toBe(10);
    expect(result.onboarding.used).toBe(3);
  });

  it("does not enforce annual or onboarding limits before snapshots are initialized", () => {
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
          skuCountAtYearStart: null,
          skuCountAtOnboardingStart: null,
        },
      }),
      intendedCreateCount: 200,
      currentNonGhostSkuCount: 1_250,
      trialStartedAt: "2025-03-01T00:00:00.000Z",
    });

    expect(result.annual.limit).toBeNull();
    expect(result.annual.used).toBe(0);
    expect(result.onboarding.limit).toBeNull();
    expect(result.onboarding.used).toBe(0);
    expect(result.remainingCreateBudget).toBeNull();
    expect(result.status).toBe("allowed");
  });
});
