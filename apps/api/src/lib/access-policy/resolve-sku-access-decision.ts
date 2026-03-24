/**
 * Resolves credit-based SKU access decisions from live usage and plan snapshots.
 */
import { deriveSkuBudget } from "@v1/db/queries/brand";
import type {
  ResolveSkuAccessDecisionInput,
  ResolvedSkuAccessDecision,
} from "./types.js";

export const SKU_WARNING_THRESHOLD = 0.8;

/**
 * Resolves the current publish status from the brand's cumulative credit budget.
 */
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

  const wouldExceedIntendedPublishCount =
    remainingPublishBudget !== null &&
    intendedPublishCount > remainingPublishBudget;

  const writeAllowed = input.brandAccess.capabilities.canWriteBrandData;
  const noRemaining =
    remainingPublishBudget !== null && remainingPublishBudget <= 0;

  let status: ResolvedSkuAccessDecision["status"] = "allowed";

  if (!writeAllowed || noRemaining || wouldExceedIntendedPublishCount) {
    status = "blocked";
  } else if ((activeBudget.utilization ?? 0) >= SKU_WARNING_THRESHOLD) {
    status = "warning";
  }

  return {
    status,
    activeBudget,
    warningThreshold: SKU_WARNING_THRESHOLD,
    remainingPublishBudget,
    intendedPublishCount,
    wouldExceedIntendedPublishCount,
  };
}
