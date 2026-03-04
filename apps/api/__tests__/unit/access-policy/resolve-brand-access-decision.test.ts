import { describe, expect, it } from "bun:test";
import { resolveBrandAccessDecision } from "../../../src/lib/access-policy/resolve-brand-access-decision";
import type {
  BrandAccessDecision,
  BrandAccessSnapshot,
} from "../../../src/lib/access-policy/types";

type LifecyclePhase = NonNullable<BrandAccessSnapshot["lifecycle"]>["phase"];

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
      skuAnnualLimit: null,
      skuOnboardingLimit: null,
      skuLimitOverride: null,
      skusCreatedThisYear: 0,
      skusCreatedOnboarding: 0,
    },
    ...overrides,
  };
}

describe("resolveBrandAccessDecision", () => {
  it("maps lifecycle phases to decisions", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");

    const cases: Array<{
      phase: LifecyclePhase;
      trialEndsAt?: string | null;
      expected: BrandAccessDecision;
    }> = [
      { phase: "demo", expected: "full_access" },
      { phase: "active", expected: "full_access" },
      {
        phase: "trial",
        trialEndsAt: "2026-03-01T00:00:00.000Z",
        expected: "trial_active",
      },
      {
        phase: "trial",
        trialEndsAt: "2026-02-01T00:00:00.000Z",
        expected: "payment_required",
      },
      { phase: "expired", expected: "payment_required" },
      { phase: "past_due", expected: "past_due" },
      { phase: "suspended", expected: "suspended" },
      { phase: "cancelled", expected: "cancelled" },
    ];

    for (const testCase of cases) {
      const snapshot = buildSnapshot({
        lifecycle: {
          phase: testCase.phase,
          trialEndsAt: testCase.trialEndsAt ?? null,
        },
      });

      const result = resolveBrandAccessDecision({
        role: "owner",
        snapshot,
        now,
      });

      expect(result.decision).toBe(testCase.expected);
    }
  });

  it("treats trial expiry boundary as payment required", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");
    const snapshot = buildSnapshot({
      lifecycle: {
        phase: "trial",
        trialEndsAt: now.toISOString(),
      },
    });

    const result = resolveBrandAccessDecision({
      role: "owner",
      snapshot,
      now,
    });

    expect(result.decision).toBe("payment_required");
  });

  it("applies billing override precedence and expiry", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");

    const temporaryBlock = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: { phase: "active", trialEndsAt: null },
        billing: {
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-03-05T00:00:00.000Z",
        },
      }),
      now,
    });

    expect(temporaryBlock.decision).toBe("suspended");

    const temporaryAllow = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: { phase: "suspended", trialEndsAt: null },
        billing: {
          billingAccessOverride: "temporary_allow",
          billingOverrideExpiresAt: "2026-03-05T00:00:00.000Z",
        },
      }),
      now,
    });

    expect(temporaryAllow.decision).toBe("full_access");

    const expiredOverride = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: { phase: "active", trialEndsAt: null },
        billing: {
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-02-01T00:00:00.000Z",
        },
      }),
      now,
    });

    expect(expiredOverride.decision).toBe("full_access");
  });

  it("prioritizes avelero bypass over blocked states", () => {
    const result = resolveBrandAccessDecision({
      role: "avelero",
      snapshot: buildSnapshot({
        lifecycle: { phase: "cancelled", trialEndsAt: null },
        billing: {
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-12-01T00:00:00.000Z",
        },
      }),
      now: new Date("2026-02-28T12:00:00.000Z"),
    });

    expect(result.decision).toBe("full_access");
    expect(result.capabilities.canWriteBrandData).toBe(true);
  });
});
