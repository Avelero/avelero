import type { BrandAccessDecisionCode } from "@v1/api/src/lib/access/brand-access";

export const BILLING_BLOCKED_CODES = [
  "blocked_pending_payment",
  "blocked_past_due",
  "blocked_canceled",
] as const satisfies readonly BrandAccessDecisionCode[];

export const NON_BILLING_BLOCKED_CODES = [
  "blocked_pending_qualification",
  "blocked_rejected",
  "blocked_suspended",
  "blocked_temp_blocked",
] as const satisfies readonly BrandAccessDecisionCode[];

const BILLING_BLOCKED_SET = new Set<BrandAccessDecisionCode>(BILLING_BLOCKED_CODES);
const NON_BILLING_BLOCKED_SET = new Set<BrandAccessDecisionCode>(
  NON_BILLING_BLOCKED_CODES,
);

function normalizePath(pathname: string) {
  if (!pathname.startsWith("/")) {
    return `/${pathname.replace(/^\/+/, "")}`;
  }
  return pathname.replace(/\/+$/, "") || "/";
}

export function isBillingBlockedDecision(code: BrandAccessDecisionCode) {
  return BILLING_BLOCKED_SET.has(code);
}

export function isNonBillingBlockedDecision(code: BrandAccessDecisionCode) {
  return NON_BILLING_BLOCKED_SET.has(code);
}

export function isAllowedPathWhileBlocked(pathname: string) {
  const normalized = normalizePath(pathname);

  if (normalized === "/settings") return true;
  if (normalized === "/account") return true;
  if (normalized.startsWith("/account/")) return true;

  return false;
}

