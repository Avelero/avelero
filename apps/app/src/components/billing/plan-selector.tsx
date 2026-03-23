/**
 * Interactive plan selector used by paywalls and billing settings.
 *
 * - Upgrade → Stripe Checkout with a fresh billing cycle (button loading → redirect)
 * - Downgrade → confirmation modal, change takes effect at period end
 * - Renew (undo cancellation) → immediate with success toast
 * - New subscription (no active sub) → Stripe Checkout redirect
 */
"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "@v1/ui/sonner";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanCard } from "./plan-card";
import { PLAN_DISPLAY, PLAN_TIERS, type PlanTier } from "./plan-features";
import { DowngradeConfirmationDialog } from "./upgrade-confirmation-dialog";

/**
 * Determine whether the selected plan change should use the upgrade checkout flow.
 */
function isUpgrade(
  fromTier: PlanTier,
  fromInterval: "quarterly" | "yearly",
  toTier: PlanTier,
  toInterval: "quarterly" | "yearly",
): boolean {
  const tierOrder: Record<PlanTier, number> = {
    starter: 0,
    growth: 1,
    scale: 2,
    enterprise: 3,
  };
  const intervalRank: Record<"quarterly" | "yearly", number> = {
    quarterly: 0,
    yearly: 1,
  };

  if (tierOrder[toTier] !== tierOrder[fromTier]) {
    return tierOrder[toTier] > tierOrder[fromTier];
  }

  return intervalRank[toInterval] > intervalRank[fromInterval];
}

interface PlanSelectorProps {
  currentPlan?: "starter" | "growth" | "scale" | null;
  currentInterval?: "quarterly" | "yearly" | null;
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
  periodEnd = null,
  context,
}: PlanSelectorProps) {
  // Keep the selector state local so the page can switch between upgrade and downgrade flows instantly.
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [interval, setInterval] = useState<"quarterly" | "yearly">(
    currentInterval ?? "yearly",
  );
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  // Downgrade confirmation dialog state
  const [downgradeTarget, setDowngradeTarget] = useState<{
    tier: "starter" | "growth" | "scale";
    interval: "quarterly" | "yearly";
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

  const upgradeCheckoutMutation = useMutation(
    trpc.brand.billing.createUpgradeCheckout.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        setLoadingTier(null);
        toast.error("Failed to start upgrade checkout. Please try again.");
      },
    }),
  );

  const updatePlanMutation = useMutation(
    trpc.brand.billing.updatePlan.mutationOptions({
      onSuccess: (data) => {
        setLoadingTier(null);
        setDowngradeTarget(null);
        void queryClient.invalidateQueries({
          queryKey: trpc.brand.billing.getStatus.queryKey(),
        });
        router.refresh();
        toast.success(
          data.changeTiming === "scheduled"
            ? "Your downgrade has been scheduled."
            : "Your plan has been updated.",
        );
      },
      onError: () => {
        setLoadingTier(null);
        setDowngradeTarget(null);
        toast.error("Failed to update plan. Please try again.");
      },
    }),
  );

  const hasActiveSubscription = hasSubscription && !!currentPlan;

  const isCurrentTier = (tier: PlanTier) =>
    hasActiveSubscription && currentPlan === tier;

  const isActualChange = (tier: PlanTier, targetInterval: "quarterly" | "yearly") =>
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
      // checkout — the customer needs to pay for the new plan.
      if (pendingCancellation) {
        setLoadingTier(selectedTier);
        checkoutMutation.mutate({
          tier: selectedTier,
          interval,
          include_impact: hasImpact ?? false,
        });
        return;
      }

      if (isActualChange(tier, interval)) {
        if (
          currentPlan &&
          currentInterval &&
          isUpgrade(currentPlan, currentInterval, selectedTier, interval)
        ) {
          // Upgrade: redirect to Stripe Checkout so the new billing cycle starts immediately.
          setLoadingTier(selectedTier);
          upgradeCheckoutMutation.mutate({
            tier: selectedTier,
            interval,
            include_impact: hasImpact ?? false,
          });
        } else {
          // Downgrade: show confirmation modal
          setDowngradeTarget({ tier: selectedTier, interval });
        }
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

  const handleConfirmDowngrade = () => {
    if (!downgradeTarget) return;
    setLoadingTier(downgradeTarget.tier);
    updatePlanMutation.mutate({
      tier: downgradeTarget.tier,
      interval: downgradeTarget.interval,
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

      {/* Downgrade confirmation dialog */}
      {downgradeTarget && (
        <DowngradeConfirmationDialog
          open={!!downgradeTarget}
          onOpenChange={(open) => {
            if (!open) setDowngradeTarget(null);
          }}
          onConfirm={handleConfirmDowngrade}
          isPending={updatePlanMutation.isPending}
          toTier={downgradeTarget.tier}
          toInterval={downgradeTarget.interval}
          periodEnd={periodEnd}
        />
      )}
    </div>
  );
}
