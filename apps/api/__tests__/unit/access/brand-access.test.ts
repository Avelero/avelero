import { describe, expect, it } from "bun:test";
import { resolveBrandAccessDecision } from "../../../src/lib/access/brand-access";

const qualifiedBase = {
  hasMembership: true,
  hasActiveBrand: true,
  brandId: "brand-1",
  planType: "starter" as const,
  qualificationStatus: "qualified" as const,
  operationalStatus: "active" as const,
  billingStatus: "active" as const,
  billingAccessOverride: "none" as const,
};

describe("resolveBrandAccessDecision", () => {
  it("returns blocked_no_membership before all other checks", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      hasMembership: false,
    });

    expect(result.code).toBe("blocked_no_membership");
    expect(result.allowed).toBe(false);
  });

  it("returns blocked_no_active_brand when membership exists but no active brand", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      hasActiveBrand: false,
      brandId: null,
    });

    expect(result.code).toBe("blocked_no_active_brand");
  });

  it("prioritizes temporary_block override over all other statuses", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "active",
      billingAccessOverride: "temporary_block",
    });

    expect(result.code).toBe("blocked_temp_blocked");
  });

  it("returns blocked_suspended before billing checks", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      operationalStatus: "suspended",
      billingStatus: "active",
    });

    expect(result.code).toBe("blocked_suspended");
  });

  it("returns blocked_pending_qualification for non-qualified brands", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      qualificationStatus: "pending",
      billingStatus: "active",
    });

    expect(result.code).toBe("blocked_pending_qualification");
  });

  it("returns blocked_rejected when qualification is rejected", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      qualificationStatus: "rejected",
      billingStatus: "active",
    });

    expect(result.code).toBe("blocked_rejected");
  });

  it("returns allowed_temp_override for temporary_allow even if billing is not active", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "pending_payment",
      billingAccessOverride: "temporary_allow",
    });

    expect(result.code).toBe("allowed_temp_override");
    expect(result.allowed).toBe(true);
  });

  it("returns blocked_past_due for past due billing", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "past_due",
    });

    expect(result.code).toBe("blocked_past_due");
  });

  it("returns blocked_canceled for canceled billing", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "canceled",
    });

    expect(result.code).toBe("blocked_canceled");
  });

  it("returns blocked_pending_payment for other non-active billing states", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "unconfigured",
    });

    expect(result.code).toBe("blocked_pending_payment");
  });

  it("returns allowed for qualified active billing state", () => {
    const result = resolveBrandAccessDecision({
      ...qualifiedBase,
      billingStatus: "active",
    });

    expect(result.code).toBe("allowed");
    expect(result.allowed).toBe(true);
  });
});

