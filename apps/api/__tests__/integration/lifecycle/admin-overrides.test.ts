/**
 * Integration Tests: Admin billing access overrides.
 */
import "../../setup";

import { describe, expect, it } from "bun:test";
import { createTestBrand } from "@v1/db/testing";
import { resolveBrandAccessDecision } from "../../../src/lib/access-policy/resolve-brand-access-decision";
import { getBrandAccessSnapshot } from "@v1/db/queries/brand";
import {
  daysAgo,
  daysFromNow,
  setBrandSubscriptionState,
} from "../../helpers/billing";
import { testDb } from "@v1/db/testing";

describe("admin billing overrides", () => {
  it("temporary_allow grants full access on suspended brand", async () => {
    const brandId = await createTestBrand("Override Allow Suspended Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "suspended",
      billingOverride: "temporary_allow",
      billingOverrideExpiresAt: daysFromNow(7),
    });

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const decision = resolveBrandAccessDecision({ snapshot, role: "owner" });
    expect(decision.decision).toBe("full_access");
    expect(decision.capabilities.canWriteBrandData).toBe(true);
  });

  it("temporary_block blocks access on active brand", async () => {
    const brandId = await createTestBrand("Override Block Active Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "active",
      billingMode: "stripe_checkout",
      stripeCustomerId: "cus_override_block",
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: daysFromNow(30),
      billingOverride: "temporary_block",
      billingOverrideExpiresAt: daysFromNow(7),
      skuAnnualLimit: 500,
    });

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const decision = resolveBrandAccessDecision({ snapshot, role: "owner" });
    expect(decision.decision).toBe("temporary_blocked");
    expect(decision.capabilities.canWriteBrandData).toBe(false);
  });

  it("expired override falls through to phase-based logic", async () => {
    const brandId = await createTestBrand("Override Expired Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "suspended",
      billingOverride: "temporary_allow",
      billingOverrideExpiresAt: daysAgo(1),
    });

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const decision = resolveBrandAccessDecision({ snapshot, role: "owner" });
    expect(decision.decision).toBe("suspended");
  });

  it("override without expiry persists indefinitely", async () => {
    const brandId = await createTestBrand("Override No Expiry Brand");
    await setBrandSubscriptionState({
      brandId,
      phase: "expired",
      billingOverride: "temporary_allow",
      billingOverrideExpiresAt: null,
    });

    const snapshot = await getBrandAccessSnapshot(testDb, brandId);
    const decision = resolveBrandAccessDecision({ snapshot, role: "owner" });
    expect(decision.decision).toBe("full_access");
  });
});
