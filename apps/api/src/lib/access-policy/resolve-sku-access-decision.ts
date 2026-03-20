/**
 * Resolves SKU access decisions from derived live SKU usage and plan snapshots.
 */
import { TRIAL_SKU_CAP, deriveSkuBudget } from "@v1/db/queries/brand";
import type {
  ResolveSkuAccessDecisionInput,
  ResolvedSkuAccessDecision,
} from "./types.js";

export const SKU_WARNING_THRESHOLD = 0.8;
export { TRIAL_SKU_CAP };

export function resolveSkuAccessDecision(
  input: ResolveSkuAccessDecisionInput,
): ResolvedSkuAccessDecision {
  // Sanitize the requested create count before applying budget checks.
  const intendedCreateCount =
    typeof input.intendedCreateCount === "number" &&
    Number.isFinite(input.intendedCreateCount)
      ? Math.max(0, Math.trunc(input.intendedCreateCount))
      : 0;
  const derivedBudget = deriveSkuBudget({
    snapshot: input.snapshot,
    currentSkuUsageCount:
      input.currentSkuUsageCount ?? input.currentNonGhostSkuCount ?? 0,
    evaluationDate: input.evaluationDate,
  });
  const activeBudget = derivedBudget.activeBudget;
  const remainingCreateBudget = activeBudget.remaining;
  const { annual, onboarding, trial } = derivedBudget;

  const wouldExceedIntendedCreateCount =
    remainingCreateBudget !== null &&
    intendedCreateCount > remainingCreateBudget;

  const maxUtilization = Math.max(
    activeBudget.utilization ?? 0,
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
    activeBudget,
    annual,
    onboarding,
    warningThreshold: SKU_WARNING_THRESHOLD,
    trialCap: TRIAL_SKU_CAP,
    trialUniversalCap: TRIAL_SKU_CAP,
    remainingCreateBudget,
    intendedCreateCount,
    wouldExceedIntendedCreateCount,
  };
}
