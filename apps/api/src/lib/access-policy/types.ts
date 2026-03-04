import type { Role } from "../../config/roles.js";

export type BrandLifecyclePhase =
  | "demo"
  | "trial"
  | "expired"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

export type BillingAccessOverride = "none" | "temporary_allow" | "temporary_block";

export type BrandAccessDecision =
  | "full_access"
  | "trial_active"
  | "payment_required"
  | "past_due"
  | "suspended"
  | "cancelled";

export interface BrandAccessCapabilities {
  canReadBrandData: boolean;
  canWriteBrandData: boolean;
  canCreateSkus: boolean;
}

export type BrandAccessOverlay =
  | "none"
  | "payment_required"
  | "suspended"
  | "cancelled";

export type BrandAccessBanner = "none" | "past_due";

export interface BrandAccessSnapshot {
  brandId: string;
  lifecycle: {
    phase: BrandLifecyclePhase;
    trialEndsAt: string | null;
  } | null;
  billing: {
    billingAccessOverride: BillingAccessOverride;
    billingOverrideExpiresAt: string | null;
  } | null;
  plan: {
    skuAnnualLimit: number | null;
    skuOnboardingLimit: number | null;
    skuLimitOverride: number | null;
    skusCreatedThisYear: number;
    skusCreatedOnboarding: number;
  } | null;
}

export interface ResolveBrandAccessDecisionInput {
  role: Role | null;
  snapshot: BrandAccessSnapshot;
  now?: Date;
}

export interface ResolvedBrandAccessDecision {
  decision: BrandAccessDecision;
  capabilities: BrandAccessCapabilities;
  overlay: BrandAccessOverlay;
  banner: BrandAccessBanner;
  phase: BrandLifecyclePhase;
  trialEndsAt: string | null;
}

export type SkuAccessStatus = "allowed" | "warning" | "blocked";

export interface SkuAccessBudget {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

export interface ResolveSkuAccessDecisionInput {
  brandAccess: ResolvedBrandAccessDecision;
  snapshot: BrandAccessSnapshot;
  intendedCreateCount?: number;
}

export interface ResolvedSkuAccessDecision {
  status: SkuAccessStatus;
  annual: SkuAccessBudget;
  onboarding: SkuAccessBudget;
  warningThreshold: number;
  trialUniversalCap: number;
  remainingCreateBudget: number | null;
  intendedCreateCount: number;
  wouldExceedIntendedCreateCount: boolean;
}
