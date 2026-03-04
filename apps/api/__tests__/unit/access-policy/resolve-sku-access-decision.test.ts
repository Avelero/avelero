import { describe, expect, it } from "bun:test";
import { resolveSkuAccessDecision } from "../../../src/lib/access-policy/resolve-sku-access-decision";
import type {
  BrandAccessSnapshot,
  ResolvedBrandAccessDecision,
} from "../../../src/lib/access-policy/types";

function buildSnapshot(overrides: Partial<BrandAccessSnapshot> = {}): BrandAccessSnapshot {
  return {
    brandId: "brand-1",
    lifecycle: {
      phase: "active",
      trialEndsAt: null,
    },
    billing: {
      billingAccessOverride: "none",
      billingOverrideExpiresAt: null,
    },
    plan: {
      skuAnnualLimit: 100,
      skuOnboardingLimit: null,
      skuLimitOverride: null,
      skusCreatedThisYear: 0,
      skusCreatedOnboarding: 0,
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
          skusCreatedThisYear: 79,
          skusCreatedOnboarding: 0,
        },
      }),
    });
    expect(seventyNine.status).toBe("allowed");

    const eighty = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skusCreatedThisYear: 80,
          skusCreatedOnboarding: 0,
        },
      }),
    });
    expect(eighty.status).toBe("warning");

    const hundred = resolveSkuAccessDecision({
      brandAccess,
      snapshot: buildSnapshot({
        plan: {
          skuAnnualLimit: 100,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skusCreatedThisYear: 100,
          skusCreatedOnboarding: 0,
        },
      }),
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
          trialEndsAt: "2026-03-10T00:00:00.000Z",
        },
        plan: {
          skuAnnualLimit: null,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skusCreatedThisYear: 49_999,
          skusCreatedOnboarding: 49_999,
        },
      }),
    });

    expect(nearCap.status).toBe("warning");
    expect(nearCap.remainingCreateBudget).toBe(1);

    const atCap = resolveSkuAccessDecision({
      brandAccess: trialAccess,
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "trial",
          trialEndsAt: "2026-03-10T00:00:00.000Z",
        },
        plan: {
          skuAnnualLimit: null,
          skuOnboardingLimit: null,
          skuLimitOverride: null,
          skusCreatedThisYear: 50_000,
          skusCreatedOnboarding: 50_000,
        },
      }),
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
          skusCreatedThisYear: 9,
          skusCreatedOnboarding: 0,
        },
      }),
      intendedCreateCount: 2,
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
          skusCreatedThisYear: 0,
          skusCreatedOnboarding: 0,
        },
      }),
    });

    expect(result.status).toBe("blocked");
  });
});
