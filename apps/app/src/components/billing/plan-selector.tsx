"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanCard } from "./plan-card";
import { PLAN_TIERS, type PlanTier } from "./plan-features";

interface PlanSelectorProps {
  currentPlan?: "starter" | "growth" | "scale" | null;
  currentInterval?: "monthly" | "yearly" | null;
  hasImpact?: boolean;
  context: "paywall" | "settings";
}

export function PlanSelector({
  currentPlan,
  currentInterval,
  hasImpact,
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

  const handleSelect = (tier: PlanTier) => {
    if (tier === "enterprise") return;
    setLoadingTier(tier);

    const selectedTier = tier as "starter" | "growth" | "scale";

    if (currentPlan) {
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
        <h2 className="type-large !font-semibold text-primary">
          {currentPlan ? "Change plan" : "Choose your plan"}
        </h2>
        <BillingIntervalToggle interval={interval} onChange={setInterval} />
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLAN_TIERS.map((tier) => (
          <PlanCard
            key={tier}
            tier={tier}
            interval={interval}
            onSelect={handleSelect}
            isCurrentPlan={currentPlan === tier}
            isLoading={loadingTier === tier}
            disabled={isAnyLoading}
          />
        ))}
      </div>
    </div>
  );
}
