/**
 * Covers brand-level lifecycle access decisions.
 */
import { describe, expect, it } from "bun:test";
import { resolveBrandAccessDecision } from "../../../src/lib/access-policy/resolve-brand-access-decision";
import type {
  BrandAccessDecision,
  BrandAccessSnapshot,
} from "../../../src/lib/access-policy/types";

type LifecyclePhase = NonNullable<BrandAccessSnapshot["lifecycle"]>["phase"];

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
      totalCredits: 50,
      onboardingDiscountUsed: false,
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
          trialStartedAt: null,
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
        trialStartedAt: null,
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
        lifecycle: { phase: "active", trialStartedAt: null, trialEndsAt: null },
        billing: {
          billingMode: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-03-05T00:00:00.000Z",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pastDueSince: null,
          pendingCancellation: false,
        },
      }),
      now,
    });

    expect(temporaryBlock.decision).toBe("temporary_blocked");

    const temporaryAllow = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "suspended",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        billing: {
          billingMode: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          billingAccessOverride: "temporary_allow",
          billingOverrideExpiresAt: "2026-03-05T00:00:00.000Z",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pastDueSince: null,
          pendingCancellation: false,
        },
      }),
      now,
    });

    expect(temporaryAllow.decision).toBe("full_access");

    const expiredOverride = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: { phase: "active", trialStartedAt: null, trialEndsAt: null },
        billing: {
          billingMode: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-02-01T00:00:00.000Z",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pastDueSince: null,
          pendingCancellation: false,
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
        lifecycle: {
          phase: "cancelled",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        billing: {
          billingMode: null,
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          billingAccessOverride: "temporary_block",
          billingOverrideExpiresAt: "2026-12-01T00:00:00.000Z",
          currentPeriodStart: null,
          currentPeriodEnd: null,
          pastDueSince: null,
          pendingCancellation: false,
        },
      }),
      now: new Date("2026-02-28T12:00:00.000Z"),
    });

    expect(result.decision).toBe("full_access");
    expect(result.capabilities.canWriteBrandData).toBe(true);
  });

  it("keeps access active for cancelled brands with remaining paid time", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");
    const result = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "cancelled",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        billing: {
          billingMode: "stripe_checkout",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: null,
          billingAccessOverride: "none",
          billingOverrideExpiresAt: null,
          currentPeriodStart: "2026-02-01T00:00:00.000Z",
          currentPeriodEnd: "2026-03-15T00:00:00.000Z",
          pastDueSince: null,
          pendingCancellation: true,
        },
      }),
      now,
    });

    expect(result.decision).toBe("full_access");
    expect(result.banner).toBe("pending_cancellation");
  });

  it("keeps writes enabled during the 14-day past-due grace window", () => {
    const now = new Date("2026-02-28T12:00:00.000Z");
    const result = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "past_due",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        billing: {
          billingMode: "stripe_checkout",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          billingAccessOverride: "none",
          billingOverrideExpiresAt: null,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          pastDueSince: "2026-02-20T00:00:00.000Z",
          pendingCancellation: false,
        },
      }),
      now,
    });

    expect(result.decision).toBe("past_due");
    expect(result.capabilities.canWriteBrandData).toBe(true);
    expect(result.banner).toBe("past_due");
  });

  it("blocks writes after the 14-day past-due grace period expires", () => {
    const now = new Date("2026-03-15T12:00:00.000Z");
    const result = resolveBrandAccessDecision({
      role: "owner",
      snapshot: buildSnapshot({
        lifecycle: {
          phase: "past_due",
          trialStartedAt: null,
          trialEndsAt: null,
        },
        billing: {
          billingMode: "stripe_checkout",
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          billingAccessOverride: "none",
          billingOverrideExpiresAt: null,
          currentPeriodStart: "2026-01-01T00:00:00.000Z",
          currentPeriodEnd: "2026-02-01T00:00:00.000Z",
          pastDueSince: "2026-02-20T00:00:00.000Z",
          pendingCancellation: false,
        },
      }),
      now,
    });

    expect(result.decision).toBe("payment_required");
    expect(result.capabilities.canWriteBrandData).toBe(false);
    expect(result.capabilities.canReadBrandData).toBe(true);
  });
});
