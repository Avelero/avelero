/**
 * Resolves SKU access decisions from derived live SKU usage and plan snapshots.
 */
import { TRIAL_UNIVERSAL_CAP, deriveSkuBudget } from "@v1/db/queries/brand";
import type {
  ResolveSkuAccessDecisionInput,
  ResolvedSkuAccessDecision,
} from "./types.js";

export const SKU_WARNING_THRESHOLD = 0.8;
export { TRIAL_UNIVERSAL_CAP };

export function resolveSkuAccessDecision(
  input: ResolveSkuAccessDecisionInput,
): ResolvedSkuAccessDecision {
  // Sanitize the requested create count before applying budget checks.
  const intendedCreateCount =
    typeof input.intendedCreateCount === "number" &&
    Number.isFinite(input.intendedCreateCount)
      ? Math.max(0, Math.trunc(input.intendedCreateCount))
      : 0;
  const { annual, onboarding, trial, remainingCreateBudget } = deriveSkuBudget({
    snapshot: input.snapshot,
    currentNonGhostSkuCount: input.currentNonGhostSkuCount,
    trialStartedAt: input.trialStartedAt,
    evaluationDate: input.evaluationDate,
  });

  const wouldExceedIntendedCreateCount =
    remainingCreateBudget !== null &&
    intendedCreateCount > remainingCreateBudget;

  const maxUtilization = Math.max(
    annual.utilization ?? 0,
    onboarding.utilization ?? 0,
    trial?.utilization ?? 0,
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
