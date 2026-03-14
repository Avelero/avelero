"use client";

import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { useQuery } from "@tanstack/react-query";
import { PLAN_DISPLAY, formatPrice, type PlanTier } from "./plan-features";

interface BillingStatusCardProps {
  planType: string | null;
  billingInterval: string | null;
  hasImpactPredictions: boolean;
  phase: string;
  trialEndsAt: string | null;
}

export function BillingStatusCard({
  planType,
  billingInterval,
  hasImpactPredictions,
  phase,
}: BillingStatusCardProps) {
  const trpc = useTRPC();

  const portalQuery = useQuery(trpc.brand.billing.getPortalUrl.queryOptions());

  const tier = planType as PlanTier;
  const display = PLAN_DISPLAY[tier];
  const interval = billingInterval as "monthly" | "yearly" | null;

  const basePrice =
    interval === "yearly" ? display?.yearlyPrice : display?.monthlyPrice;
  const impactPrice =
    interval === "yearly"
      ? display?.impactYearlyPrice
      : display?.impactMonthlyPrice;
  const periodLabel = interval === "yearly" ? "/year" : "/month";

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <div>
        <h3 className="type-large !font-semibold text-primary">
          Current plan
        </h3>

        {phase === "past_due" && (
          <p className="mt-2 text-sm text-destructive">
            Your last payment failed. Please update your payment method to
            restore full access.
          </p>
        )}

        <div className="mt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              {display?.name ?? planType} Plan
            </span>
            {basePrice != null && (
              <span className="text-sm text-secondary">
                {formatPrice(basePrice)}
                {periodLabel}
              </span>
            )}
          </div>

          {interval && (
            <p className="text-sm text-secondary">
              Billing: <span className="capitalize">{interval}</span>
            </p>
          )}

          {hasImpactPredictions && impactPrice != null && (
            <p className="text-sm text-secondary">
              Impact Predictions:{" "}
              <span className="font-medium text-primary">Active</span>
              <span className="text-secondary">
                {" "}
                (+{formatPrice(impactPrice)}
                {periodLabel})
              </span>
            </p>
          )}

          {!hasImpactPredictions && (
            <p className="text-sm text-secondary">
              Impact Predictions:{" "}
              <span className="text-tertiary">Not active</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-5">
        <Button
          size="sm"
          variant="outline"
          disabled={portalQuery.isLoading || !portalQuery.data}
          onClick={() => {
            if (portalQuery.data?.url) {
              window.open(portalQuery.data.url, "_blank");
            }
          }}
        >
          {portalQuery.isLoading ? (
            <Icons.Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Manage billing"
          )}
        </Button>
      </div>
    </div>
  );
}
