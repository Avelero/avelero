"use client";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BillingStatusCard } from "./billing-status-card";
import { SkuUsageBar } from "./sku-usage-bar";

/**
 * Billing settings page content for brands with an active or past_due plan.
 * Trial/expired brands are redirected away by the page server component.
 */
export function BillingPageContent() {
  const trpc = useTRPC();

  const statusQuery = useQuery(trpc.brand.billing.getStatus.queryOptions());
  const initQuery = useQuery(trpc.composite.initDashboard.queryOptions());

  const status = statusQuery.data;
  const sku = initQuery.data?.sku;

  if (!status) {
    return (
      <div className="w-full max-w-[700px]">
        <div className="space-y-4">
          <div className="h-40 animate-pulse rounded-xl border border-border bg-muted/30" />
          <div className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[700px] space-y-8">
      {/* Billing status card */}
      <BillingStatusCard
        planType={status.plan_type}
        billingInterval={status.billing_interval}
        hasImpactPredictions={status.has_impact_predictions}
        phase={status.phase}
        trialEndsAt={status.trial_ends_at}
      />

      {/* SKU usage */}
      {sku && (sku.annual.limit != null || (sku.onboarding.limit != null && sku.onboarding.limit > 0)) && (
        <div className="rounded-xl border border-border bg-background p-6">
          <h3 className="type-large !font-semibold text-primary">Usage</h3>
          <div className="mt-4 space-y-4">
            {sku.annual.limit != null && (
              <SkuUsageBar
                used={sku.annual.used}
                limit={sku.annual.limit}
                label="new SKUs used this year"
              />
            )}
            {sku.onboarding.limit != null && sku.onboarding.limit > 0 && (
              <SkuUsageBar
                used={sku.onboarding.used}
                limit={sku.onboarding.limit}
                label="onboarding SKUs used"
              />
            )}
          </div>
        </div>
      )}

      {/* Impact Predictions status */}
      {status.phase === "active" && (
        <ImpactSection hasImpact={status.has_impact_predictions} />
      )}
    </div>
  );
}

/** Impact Predictions add/remove section for active brands. */
function ImpactSection({ hasImpact }: { hasImpact: boolean }) {
  const trpc = useTRPC();

  const addImpact = useMutation(
    trpc.brand.billing.addImpact.mutationOptions({
      onSuccess: () => {
        window.location.reload();
      },
    }),
  );

  const removeImpact = useMutation(
    trpc.brand.billing.removeImpact.mutationOptions({
      onSuccess: () => {
        window.location.reload();
      },
    }),
  );

  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <h3 className="type-large !font-semibold text-primary">
        Impact Predictions
      </h3>
      <p className="mt-2 type-small text-secondary">
        AI-powered CO2 and water scarcity impact estimates for every SKU.
        Supports upcoming EU digital product passport requirements without
        costly LCA analysis.
      </p>
      <div className="mt-4">
        {hasImpact ? (
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-primary">Active</span>
            <button
              type="button"
              onClick={() => {
                if (
                  window.confirm(
                    "Remove Impact Predictions? You'll lose access to CO2 and water impact estimates.",
                  )
                ) {
                  removeImpact.mutate();
                }
              }}
              disabled={removeImpact.isPending}
              className="text-sm text-destructive underline underline-offset-2 hover:text-destructive/80"
            >
              {removeImpact.isPending ? "Removing..." : "Remove add-on"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => addImpact.mutate()}
            disabled={addImpact.isPending}
            className="text-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80"
          >
            {addImpact.isPending
              ? "Adding..."
              : "Add Impact Predictions to your plan"}
          </button>
        )}
      </div>
    </div>
  );
}
