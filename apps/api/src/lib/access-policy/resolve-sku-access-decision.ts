import type {
  ResolveSkuAccessDecisionInput,
  ResolvedSkuAccessDecision,
  SkuAccessBudget,
} from "./types.js";

export const SKU_WARNING_THRESHOLD = 0.8;
export const TRIAL_UNIVERSAL_CAP = 50_000;

function sanitizeCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function sanitizeLimit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.trunc(value));
}

function createBudget(limit: number | null, used: number): SkuAccessBudget {
  if (limit === null) {
    return {
      limit: null,
      used,
      remaining: null,
      utilization: null,
    };
  }

  const remaining = Math.max(0, limit - used);
  const utilization = limit === 0 ? 1 : used / limit;

  return {
    limit,
    used,
    remaining,
    utilization,
  };
}

function minDefined(values: Array<number | null>): number | null {
  const defined = values.filter((value): value is number => value !== null);
  if (defined.length === 0) return null;
  return Math.min(...defined);
}

export function resolveSkuAccessDecision(
  input: ResolveSkuAccessDecisionInput,
): ResolvedSkuAccessDecision {
  const intendedCreateCount = sanitizeCount(input.intendedCreateCount);
  const plan = input.snapshot.plan;

  const annualLimit = sanitizeLimit(plan?.skuLimitOverride ?? plan?.skuAnnualLimit);
  const onboardingLimit = sanitizeLimit(plan?.skuOnboardingLimit);
  const annualUsed = sanitizeCount(plan?.skusCreatedThisYear);
  const onboardingUsed = sanitizeCount(plan?.skusCreatedOnboarding);

  const annual = createBudget(annualLimit, annualUsed);
  const onboarding = createBudget(onboardingLimit, onboardingUsed);

  const trialCapBudget =
    input.brandAccess.decision === "trial_active"
      ? createBudget(TRIAL_UNIVERSAL_CAP, Math.max(annualUsed, onboardingUsed))
      : null;

  const remainingCreateBudget = minDefined([
    annual.remaining,
    onboarding.remaining,
    trialCapBudget?.remaining ?? null,
  ]);

  const wouldExceedIntendedCreateCount =
    remainingCreateBudget !== null && intendedCreateCount > remainingCreateBudget;

  const maxUtilization = Math.max(
    annual.utilization ?? 0,
    onboarding.utilization ?? 0,
    trialCapBudget?.utilization ?? 0,
  );

  const writeAllowed = input.brandAccess.capabilities.canWriteBrandData;
  const noRemaining =
    remainingCreateBudget !== null && remainingCreateBudget <= 0;

  let status: ResolvedSkuAccessDecision["status"] = "allowed";

  if (!writeAllowed || noRemaining || wouldExceedIntendedCreateCount) {
    status = "blocked";
  } else if (maxUtilization >= SKU_WARNING_THRESHOLD) {
    status = "warning";
  }

  return {
    status,
    annual,
    onboarding,
    warningThreshold: SKU_WARNING_THRESHOLD,
    trialUniversalCap: TRIAL_UNIVERSAL_CAP,
    remainingCreateBudget,
    intendedCreateCount,
    wouldExceedIntendedCreateCount,
  };
}
