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
  // Sanitize the requested publish count before applying budget checks.
  const intendedPublishCount =
    typeof input.intendedPublishCount === "number" &&
    Number.isFinite(input.intendedPublishCount)
      ? Math.max(0, Math.trunc(input.intendedPublishCount))
      : 0;
  const derivedBudget = deriveSkuBudget({
    snapshot: input.snapshot,
    currentPublishUsageCount:
      input.currentPublishUsageCount ?? input.currentSkuUsageCount,
    currentSkuUsageCount:
      input.currentSkuUsageCount ?? input.currentNonGhostSkuCount ?? 0,
    evaluationDate: input.evaluationDate,
  });
  const activeBudget = derivedBudget.activeBudget;
  const remainingPublishBudget = activeBudget.remaining;
  const { annual, onboarding, trial } = derivedBudget;

  const wouldExceedIntendedPublishCount =
    remainingPublishBudget !== null &&
    intendedPublishCount > remainingPublishBudget;

  const maxUtilization = Math.max(
    activeBudget.utilization ?? 0,
    annual.utilization ?? 0,
    onboarding.utilization ?? 0,
    trial?.utilization ?? 0,
  );

  const writeAllowed = input.brandAccess.capabilities.canWriteBrandData;
  const noRemaining =
    remainingPublishBudget !== null && remainingPublishBudget <= 0;

  let status: ResolvedSkuAccessDecision["status"] = "allowed";

  if (!writeAllowed || noRemaining || wouldExceedIntendedPublishCount) {
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
    remainingPublishBudget,
    intendedPublishCount,
    wouldExceedIntendedPublishCount,
  };
}
