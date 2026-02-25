import { describe, expect, it } from "bun:test";
import {
  isAllowedPathWhileBlocked,
  isBillingBlockedDecision,
  isNonBillingBlockedDecision,
} from "./brand-access-policy";

describe("brand access route policy", () => {
  it("allows /account and /account subroutes while blocked", () => {
    expect(isAllowedPathWhileBlocked("/account")).toBe(true);
    expect(isAllowedPathWhileBlocked("/account/brands")).toBe(true);
  });

  it("allows exact /settings (with optional trailing slash) while blocked", () => {
    expect(isAllowedPathWhileBlocked("/settings")).toBe(true);
    expect(isAllowedPathWhileBlocked("/settings/")).toBe(true);
  });

  it("blocks /settings subroutes while blocked", () => {
    expect(isAllowedPathWhileBlocked("/settings/members")).toBe(false);
  });

  it("blocks core product routes while blocked", () => {
    expect(isAllowedPathWhileBlocked("/passports")).toBe(false);
    expect(isAllowedPathWhileBlocked("/theme")).toBe(false);
    expect(isAllowedPathWhileBlocked("/theme-editor")).toBe(false);
  });
});

describe("brand access decision classification", () => {
  it("classifies billing-blocked decision codes", () => {
    expect(isBillingBlockedDecision("blocked_pending_payment")).toBe(true);
    expect(isBillingBlockedDecision("blocked_past_due")).toBe(true);
    expect(isBillingBlockedDecision("blocked_canceled")).toBe(true);
    expect(isBillingBlockedDecision("blocked_suspended")).toBe(false);
  });

  it("classifies non-billing-blocked decision codes", () => {
    expect(isNonBillingBlockedDecision("blocked_pending_qualification")).toBe(
      true,
    );
    expect(isNonBillingBlockedDecision("blocked_rejected")).toBe(true);
    expect(isNonBillingBlockedDecision("blocked_suspended")).toBe(true);
    expect(isNonBillingBlockedDecision("blocked_temp_blocked")).toBe(true);
    expect(isNonBillingBlockedDecision("blocked_past_due")).toBe(false);
  });
});

