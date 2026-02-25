import {
  BRAND_BILLING_ACCESS_OVERRIDES,
  BRAND_BILLING_MODES,
  BRAND_BILLING_STATUSES,
  BRAND_OPERATIONAL_STATUSES,
  BRAND_PLAN_TYPES,
  BRAND_QUALIFICATION_STATUSES,
  type BillingAccessOverride,
  type BrandPlanType,
  type LocalBillingStatus,
  type OperationalStatus,
  type QualificationStatus,
} from "@v1/db/queries/brand";

export {
  BRAND_BILLING_ACCESS_OVERRIDES,
  BRAND_BILLING_MODES,
  BRAND_BILLING_STATUSES,
  BRAND_OPERATIONAL_STATUSES,
  BRAND_PLAN_TYPES,
  BRAND_QUALIFICATION_STATUSES,
};

export const BRAND_ACCESS_DECISIONS = {
  allowed: "allowed",
  blocked_no_membership: "blocked_no_membership",
  blocked_no_active_brand: "blocked_no_active_brand",
  blocked_pending_qualification: "blocked_pending_qualification",
  blocked_rejected: "blocked_rejected",
  blocked_pending_payment: "blocked_pending_payment",
  blocked_past_due: "blocked_past_due",
  blocked_canceled: "blocked_canceled",
  blocked_suspended: "blocked_suspended",
  blocked_temp_blocked: "blocked_temp_blocked",
  allowed_temp_override: "allowed_temp_override",
} as const;

export type BrandAccessDecisionCode =
  (typeof BRAND_ACCESS_DECISIONS)[keyof typeof BRAND_ACCESS_DECISIONS];

export type BrandAccessDecision = {
  code: BrandAccessDecisionCode;
  allowed: boolean;
  reason: string | null;
  brandId: string | null;
  planType: BrandPlanType | null;
  billingStatus: LocalBillingStatus | null;
  qualificationStatus: QualificationStatus | null;
  operationalStatus: OperationalStatus | null;
};

export type ResolveBrandAccessDecisionInput = {
  hasMembership: boolean;
  hasActiveBrand: boolean;
  brandId?: string | null;
  planType?: BrandPlanType | null;
  qualificationStatus: QualificationStatus | null;
  operationalStatus: OperationalStatus | null;
  billingStatus: LocalBillingStatus | null;
  billingAccessOverride: BillingAccessOverride | null;
};

function decision(
  code: BrandAccessDecisionCode,
  input: ResolveBrandAccessDecisionInput,
  reason: string | null,
): BrandAccessDecision {
  return {
    code,
    allowed:
      code === BRAND_ACCESS_DECISIONS.allowed ||
      code === BRAND_ACCESS_DECISIONS.allowed_temp_override,
    reason,
    brandId: input.brandId ?? null,
    planType: input.planType ?? null,
    billingStatus: input.billingStatus ?? null,
    qualificationStatus: input.qualificationStatus ?? null,
    operationalStatus: input.operationalStatus ?? null,
  };
}

/**
 * Central access decision helper used by later phases for route/action gating.
 *
 * This function is intentionally pure and deterministic so it can be unit tested
 * independently and reused by TRPC/app-level guards.
 */
export function resolveBrandAccessDecision(
  input: ResolveBrandAccessDecisionInput,
): BrandAccessDecision {
  if (!input.hasMembership) {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_no_membership,
      input,
      "User is not a member of this brand",
    );
  }

  if (!input.hasActiveBrand) {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_no_active_brand,
      input,
      "No active brand selected",
    );
  }

  if (input.billingAccessOverride === "temporary_block") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_temp_blocked,
      input,
      "Access has been temporarily blocked by an administrator",
    );
  }

  if (input.operationalStatus === "suspended") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_suspended,
      input,
      "Brand access is suspended",
    );
  }

  if (input.qualificationStatus === "rejected") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_rejected,
      input,
      "Brand qualification was rejected",
    );
  }

  if (input.qualificationStatus !== "qualified") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_pending_qualification,
      input,
      "Brand is pending qualification",
    );
  }

  if (input.billingAccessOverride === "temporary_allow") {
    return decision(
      BRAND_ACCESS_DECISIONS.allowed_temp_override,
      input,
      "Access temporarily allowed by an administrator",
    );
  }

  if (input.billingStatus === "active") {
    return decision(
      BRAND_ACCESS_DECISIONS.allowed,
      input,
      null,
    );
  }

  if (input.billingStatus === "past_due") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_past_due,
      input,
      "Billing is past due",
    );
  }

  if (input.billingStatus === "canceled") {
    return decision(
      BRAND_ACCESS_DECISIONS.blocked_canceled,
      input,
      "Subscription is canceled",
    );
  }

  return decision(
    BRAND_ACCESS_DECISIONS.blocked_pending_payment,
    input,
    "Billing is not active",
  );
}

