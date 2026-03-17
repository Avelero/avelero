"use client";

/**
 * Interactive plan selector used by paywalls and billing settings.
 */
import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanCard } from "./plan-card";
import { PLAN_DISPLAY, PLAN_TIERS, type PlanTier } from "./plan-features";

interface PlanSelectorProps {
  currentPlan?: "starter" | "growth" | "scale" | null;
  currentInterval?: "monthly" | "yearly" | null;
  hasImpact?: boolean;
  hasSubscription?: boolean;
  pendingCancellation?: boolean;
  context: "paywall" | "settings";
}

export function PlanSelector({
  // Choose whether selections should mutate the live subscription or start checkout.
  currentPlan,
  currentInterval,
  hasImpact,
  hasSubscription = false,
  pendingCancellation = false,
  context,
}: PlanSelectorProps) {
  const router = useRouter();
  const trpc = useTRPC();

  const [interval, setInterval] = useState<"monthly" | "yearly">(
    currentInterval ?? "yearly",
  );
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  const checkoutMutation = useMutation(
    trpc.brand.billing.createCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        window.location.href = data.url;
      },
      onError: () => {
        setLoadingTier(null);
      },
    }),
  );

  const updatePlanMutation = useMutation(
    trpc.brand.billing.updatePlan.mutationOptions({
      onSuccess: () => {
        setLoadingTier(null);
        router.refresh();
      },
      onError: () => {
        setLoadingTier(null);
      },
    }),
  );

  const hasActiveSubscription = hasSubscription && !!currentPlan;

  // Keep the active tier marked as current even when the pricing toggle changes.
  const isCurrentTier = (tier: PlanTier) =>
    hasActiveSubscription && currentPlan === tier;

  // Renew the existing subscription without changing its billing interval.
  const handleCurrentPlanAction = (tier: PlanTier) => {
    if (tier === "enterprise" || !hasActiveSubscription) return;
    setLoadingTier(tier);
    updatePlanMutation.mutate({
      tier: tier as "starter" | "growth" | "scale",
      interval: currentInterval ?? interval,
      include_impact: hasImpact ?? false,
    });
  };

  const handleSelect = (tier: PlanTier) => {
    // Route the action through checkout for recovery states and through subscription updates otherwise.
    if (tier === "enterprise") return;
    setLoadingTier(tier);

    const selectedTier = tier as "starter" | "growth" | "scale";

    if (hasActiveSubscription) {
      updatePlanMutation.mutate({
        tier: selectedTier,
        interval,
        include_impact: hasImpact ?? false,
      });
    } else {
      checkoutMutation.mutate({
        tier: selectedTier,
        interval,
        include_impact: false,
      });
    }
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
          const isCurrentSelection = isCurrentTier(tier);
          const showRenewAction = pendingCancellation && isCurrentSelection;

          return (
            <PlanCard
              key={tier}
              tier={tier}
              interval={interval}
              onSelect={handleSelect}
              isCurrentPlan={isCurrentSelection}
              isLoading={loadingTier === tier}
              disabled={isAnyLoading}
              currentPlanActionLabel={
                showRenewAction ? `Renew ${PLAN_DISPLAY[tier].name}` : undefined
              }
              onCurrentPlanSelect={
                showRenewAction ? () => handleCurrentPlanAction(tier) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
