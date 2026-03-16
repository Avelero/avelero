/**
 * Resolves the brand-level access decision from lifecycle, billing, and override state.
 */
import { ROLES } from "../../config/roles.js";
import type {
  BillingAccessOverride,
  BrandAccessBanner,
  BrandAccessCapabilities,
  BrandAccessDecision,
  BrandAccessOverlay,
  BrandLifecyclePhase,
  ResolveBrandAccessDecisionInput,
  ResolvedBrandAccessDecision,
} from "./types.js";

export const BILLING_GRACE_PERIOD_DAYS = 14;
const BILLING_GRACE_PERIOD_MS = BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000;

/**
 * Checks whether a temporary billing override is still active.
 */
function isBillingOverrideActive(params: {
  override: BillingAccessOverride;
  expiresAt: string | null;
  now: Date;
}): boolean {
  if (params.override === "none") return false;
  if (!params.expiresAt) return true;
  return new Date(params.expiresAt).getTime() > params.now.getTime();
}

/**
 * Safely parses an ISO timestamp into epoch milliseconds.
 */
function getTimestampMs(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Determines whether the active trial window still grants access.
 */
function hasActiveTrial(params: {
  phase: BrandLifecyclePhase;
  trialEndsAt: string | null;
  now: Date;
}): boolean {
  if (params.phase !== "trial") return false;
  const trialEndsAtMs = getTimestampMs(params.trialEndsAt);
  return trialEndsAtMs !== null && trialEndsAtMs > params.now.getTime();
}

/**
 * Determines whether the stored paid-through entitlement window is still active.
 */
function hasActiveEntitlement(params: {
  currentPeriodEnd: string | null;
  now: Date;
}): boolean {
  const currentPeriodEndMs = getTimestampMs(params.currentPeriodEnd);
  return currentPeriodEndMs !== null && currentPeriodEndMs > params.now.getTime();
}

/**
 * Computes the grace-period deadline from the first past-due timestamp.
 */
function getGraceEndsAt(pastDueSince: string | null): string | null {
  const pastDueSinceMs = getTimestampMs(pastDueSince);
  if (pastDueSinceMs === null) return null;
  return new Date(pastDueSinceMs + BILLING_GRACE_PERIOD_MS).toISOString();
}

/**
 * Determines whether a failed-payment grace period is still in effect.
 */
function hasActiveGracePeriod(params: {
  pastDueSince: string | null;
  now: Date;
}): boolean {
  const graceEndsAtMs = getTimestampMs(getGraceEndsAt(params.pastDueSince));
  return graceEndsAtMs !== null && graceEndsAtMs > params.now.getTime();
}

/**
 * Maps an access decision to the capabilities that decision grants.
 */
function capabilitiesForDecision(
  decision: BrandAccessDecision,
): BrandAccessCapabilities {
  if (
    decision === "full_access" ||
    decision === "trial_active" ||
    decision === "past_due"
  ) {
    return {
      canReadBrandData: true,
      canWriteBrandData: true,
      canCreateSkus: true,
    };
  }

  if (decision === "payment_required") {
    return {
      canReadBrandData: true,
      canWriteBrandData: false,
      canCreateSkus: false,
    };
  }

  return {
    canReadBrandData: false,
    canWriteBrandData: false,
    canCreateSkus: false,
  };
}

/**
 * Maps an access decision to the content overlay shown in the dashboard shell.
 */
function overlayForDecision(decision: BrandAccessDecision): BrandAccessOverlay {
  if (decision === "payment_required") return "payment_required";
  if (decision === "suspended") return "suspended";
  if (decision === "temporary_blocked") return "temporary_blocked";
  if (decision === "cancelled") return "cancelled";
  return "none";
}

/**
 * Maps an access decision and billing flags to the banner shown above the dashboard.
 */
function bannerForDecision(params: {
  decision: BrandAccessDecision;
  pendingCancellation: boolean;
}): BrandAccessBanner {
  if (params.pendingCancellation) return "pending_cancellation";
  if (params.decision === "past_due") return "past_due";
  return "none";
}

/**
 * Resolves the final access decision for the current request context.
 */
export function resolveBrandAccessDecision(
  input: ResolveBrandAccessDecisionInput,
): ResolvedBrandAccessDecision {
  const now = input.now ?? new Date();
  const phase = input.snapshot.lifecycle?.phase ?? "demo";
  const trialEndsAt = input.snapshot.lifecycle?.trialEndsAt ?? null;
  const billing = input.snapshot.billing;
  const currentPeriodStart = billing?.currentPeriodStart ?? null;
  const currentPeriodEnd = billing?.currentPeriodEnd ?? null;
  const pastDueSince = billing?.pastDueSince ?? null;
  const pendingCancellation = billing?.pendingCancellation ?? false;
  const graceEndsAt = getGraceEndsAt(pastDueSince);

  const activeTrial = hasActiveTrial({ phase, trialEndsAt, now });
  const activeEntitlement = hasActiveEntitlement({ currentPeriodEnd, now });
  const activeGracePeriod = hasActiveGracePeriod({ pastDueSince, now });

  let decision: BrandAccessDecision;

  if (input.role === ROLES.AVELERO) {
    decision = "full_access";
  } else if (
    billing &&
    isBillingOverrideActive({
      override: billing.billingAccessOverride,
      expiresAt: billing.billingOverrideExpiresAt,
      now,
    })
  ) {
    decision =
      billing.billingAccessOverride === "temporary_block"
        ? "temporary_blocked"
        : "full_access";
  } else if (phase === "suspended") {
    decision = "suspended";
  } else if (activeEntitlement) {
    decision = pastDueSince ? "past_due" : "full_access";
  } else if (activeTrial) {
    decision = "trial_active";
  } else if (activeGracePeriod) {
    decision = "past_due";
  } else if (phase === "past_due" && !billing?.pastDueSince && !billing?.currentPeriodEnd) {
    // Preserve legacy behavior for rows that have not been backfilled yet.
    decision = "past_due";
  } else if (phase === "cancelled") {
    decision = "cancelled";
  } else if (phase === "demo") {
    decision = "full_access";
  } else if (phase === "active" && !billing?.currentPeriodEnd) {
    // Preserve access for legacy rows until Stripe projection has backfilled entitlement dates.
    decision = "full_access";
  } else {
    decision = "payment_required";
  }

  return {
    decision,
    capabilities: capabilitiesForDecision(decision),
    overlay: overlayForDecision(decision),
    banner: bannerForDecision({
      decision,
      pendingCancellation: pendingCancellation && decision !== "cancelled",
    }),
    phase,
    trialEndsAt,
    currentPeriodStart,
    currentPeriodEnd,
    pastDueSince,
    pendingCancellation,
    graceEndsAt,
  };
}
