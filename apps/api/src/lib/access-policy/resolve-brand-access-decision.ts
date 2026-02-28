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

function isBillingOverrideActive(params: {
  override: BillingAccessOverride;
  expiresAt: string | null;
  now: Date;
}): boolean {
  if (params.override === "none") return false;
  if (!params.expiresAt) return true;
  return new Date(params.expiresAt).getTime() > params.now.getTime();
}

function resolvePhaseDecision(params: {
  phase: BrandLifecyclePhase;
  trialEndsAt: string | null;
  now: Date;
}): BrandAccessDecision {
  const { phase, trialEndsAt, now } = params;

  if (phase === "demo" || phase === "active") {
    return "full_access";
  }

  if (phase === "trial") {
    if (trialEndsAt && new Date(trialEndsAt).getTime() > now.getTime()) {
      return "trial_active";
    }
    return "payment_required";
  }

  if (phase === "expired") {
    return "payment_required";
  }

  if (phase === "past_due") {
    return "past_due";
  }

  if (phase === "suspended") {
    return "suspended";
  }

  return "cancelled";
}

function capabilitiesForDecision(
  decision: BrandAccessDecision,
): BrandAccessCapabilities {
  if (decision === "full_access" || decision === "trial_active") {
    return {
      canReadBrandData: true,
      canWriteBrandData: true,
      canCreateSkus: true,
    };
  }

  if (decision === "payment_required" || decision === "past_due") {
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

function overlayForDecision(decision: BrandAccessDecision): BrandAccessOverlay {
  if (decision === "payment_required") return "payment_required";
  if (decision === "suspended") return "suspended";
  if (decision === "cancelled") return "cancelled";
  return "none";
}

function bannerForDecision(decision: BrandAccessDecision): BrandAccessBanner {
  if (decision === "past_due") return "past_due";
  return "none";
}

export function resolveBrandAccessDecision(
  input: ResolveBrandAccessDecisionInput,
): ResolvedBrandAccessDecision {
  const now = input.now ?? new Date();
  const phase = input.snapshot.lifecycle?.phase ?? "demo";
  const trialEndsAt = input.snapshot.lifecycle?.trialEndsAt ?? null;
  const billing = input.snapshot.billing;

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
        ? "suspended"
        : "full_access";
  } else {
    decision = resolvePhaseDecision({ phase, trialEndsAt, now });
  }

  return {
    decision,
    capabilities: capabilitiesForDecision(decision),
    overlay: overlayForDecision(decision),
    banner: bannerForDecision(decision),
    phase,
    trialEndsAt,
  };
}
