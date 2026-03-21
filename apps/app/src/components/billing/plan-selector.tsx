"use client";

/**
 * Interactive plan selector used by paywalls and billing settings.
 *
 * - Upgrade/downgrade/interval-change → confirmation dialog with proration estimate
 * - Renew (undo cancellation) → immediate with success toast
 * - New subscription (no active sub) → Stripe Checkout redirect
 */
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@v1/ui/sonner";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanCard } from "./plan-card";
import { PLAN_DISPLAY, PLAN_TIERS, type PlanTier } from "./plan-features";
import { UpgradeConfirmationDialog } from "./upgrade-confirmation-dialog";

interface PlanSelectorProps {
  currentPlan?: "starter" | "growth" | "scale" | null;
  currentInterval?: "monthly" | "yearly" | null;
  hasImpact?: boolean;
  hasSubscription?: boolean;
  pendingCancellation?: boolean;
  periodStart?: string | null;
  periodEnd?: string | null;
  context: "paywall" | "settings";
}

export function PlanSelector({
  currentPlan,
  currentInterval,
  hasImpact,
  hasSubscription = false,
  pendingCancellation = false,
  periodStart = null,
  periodEnd = null,
  context,
}: PlanSelectorProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [interval, setInterval] = useState<"monthly" | "yearly">(
    currentInterval ?? "yearly",
  );
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  // Confirmation dialog state for upgrades/downgrades/interval changes
  const [confirmTarget, setConfirmTarget] = useState<{
    tier: "starter" | "growth" | "scale";
    interval: "monthly" | "yearly";
  } | null>(null);

  const checkoutMutation = useMutation(
    trpc.brand.billing.createCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        setLoadingTier(null);
        toast.error("Failed to start checkout. Please try again.");
      },
    }),
  );

  const updatePlanMutation = useMutation(
    trpc.brand.billing.updatePlan.mutationOptions({
      onSuccess: () => {
        setLoadingTier(null);
        setConfirmTarget(null);
        // Invalidate billing status so the UI reflects the new state immediately
        // instead of relying on stale data that may still show pendingCancellation.
        void queryClient.invalidateQueries({
          queryKey: trpc.brand.billing.getStatus.queryKey(),
        });
        router.refresh();
        toast.success("Your plan has been updated.");
      },
      onError: () => {
        setLoadingTier(null);
        setConfirmTarget(null);
        toast.error("Failed to update plan. Please try again.");
      },
    }),
  );

  const hasActiveSubscription = hasSubscription && !!currentPlan;

  // Keep the active tier marked as current even when the pricing toggle changes.
  const isCurrentTier = (tier: PlanTier) =>
    hasActiveSubscription && currentPlan === tier;

  // Determine whether a plan change represents an actual subscription modification.
  const isActualChange = (tier: PlanTier, targetInterval: "monthly" | "yearly") =>
    tier !== currentPlan || targetInterval !== currentInterval;

  // Renew: undo pending cancellation. Frictionless — no confirmation needed.
  const handleRenew = (tier: PlanTier) => {
    if (tier === "enterprise" || !hasActiveSubscription) return;
    setLoadingTier(tier);
    updatePlanMutation.mutate({
      tier: tier as "starter" | "growth" | "scale",
      interval: currentInterval ?? interval,
      include_impact: hasImpact ?? false,
    });
  };

  const handleSelect = (tier: PlanTier) => {
    if (tier === "enterprise") return;

    const selectedTier = tier as "starter" | "growth" | "scale";

    if (hasActiveSubscription) {
      // If pending cancellation and selecting a different tier, route through
      // checkout instead of updatePlan — the customer needs to pay for the
      // new plan, not just undo the cancellation.
      if (pendingCancellation) {
        setLoadingTier(selectedTier);
        checkoutMutation.mutate({
          tier: selectedTier,
          interval,
          include_impact: hasImpact ?? false,
        });
        return;
      }

      // Show confirmation dialog for all plan changes (tier or interval)
      if (isActualChange(tier, interval)) {
        setConfirmTarget({ tier: selectedTier, interval });
        return;
      }

      // No actual change — no-op
      return;
    }

    // No active subscription → go through Stripe Checkout
    setLoadingTier(selectedTier);
    checkoutMutation.mutate({
      tier: selectedTier,
      interval,
      include_impact: false,
    });
  };

  const handleConfirmChange = () => {
    if (!confirmTarget) return;
    setLoadingTier(confirmTarget.tier);
    updatePlanMutation.mutate({
      tier: confirmTarget.tier,
      interval: confirmTarget.interval,
      include_impact: hasImpact ?? false,
    });
  };

  const isAnyLoading = loadingTier != null;

  return (
    <div className="space-y-6">
      {/* Header row: title left, toggle right */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-primary sm:text-4xl">
          Select plan
        </h2>
        <BillingIntervalToggle interval={interval} onChange={setInterval} />
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => {
          const isCurrent = isCurrentTier(tier);
          const isCurrentAndSameInterval =
            isCurrent && interval === currentInterval;
          const showRenewAction =
            pendingCancellation && isCurrentAndSameInterval;

          // If the user is on this tier but toggled to a different interval,
          // show "Select" to allow interval switching (not "Current plan").
          const treatAsCurrent = isCurrentAndSameInterval;

          return (
            <PlanCard
              key={tier}
              tier={tier}
              interval={interval}
              onSelect={handleSelect}
              isCurrentPlan={treatAsCurrent}
              isLoading={loadingTier === tier}
              disabled={isAnyLoading}
              currentPlanActionLabel={
                showRenewAction
                  ? `Renew ${PLAN_DISPLAY[tier].name}`
                  : undefined
              }
              onCurrentPlanSelect={
                showRenewAction ? () => handleRenew(tier) : undefined
              }
            />
          );
        })}
      </div>

      {/* Upgrade/downgrade confirmation dialog */}
      {confirmTarget && currentPlan && currentInterval && (
        <UpgradeConfirmationDialog
          open={!!confirmTarget}
          onOpenChange={(open) => {
            if (!open) setConfirmTarget(null);
          }}
          onConfirm={handleConfirmChange}
          isPending={updatePlanMutation.isPending}
          fromTier={currentPlan}
          fromInterval={currentInterval}
          toTier={confirmTarget.tier}
          toInterval={confirmTarget.interval}
          periodStart={periodStart}
          periodEnd={periodEnd}
        />
      )}
    </div>
  );
}
