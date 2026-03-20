/**
 * Renders SKU usage for the active brand using billing status data.
 */
"use client";

import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { SkuUsageBar } from "./sku-usage-bar";

const ONBOARDING_TOOLTIP =
  "In your first paid year you have a higher onboarding SKU limit. Your regular yearly limit starts after that.";

/**
 * Renders the single active SKU budget for the brand's current lifecycle phase.
 */
export function UsagePageContent() {
  // Load billing status so the usage page can render plan limits even when dashboard SKU snapshots lag behind.
  const trpc = useTRPC();
  const statusQuery = useQuery(trpc.brand.billing.getStatus.queryOptions());
  const status = statusQuery.data;

  if (!status) {
    return (
      <div className="w-full max-w-[700px]">
        <div className="border p-6">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1.5 h-4 w-64" />
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const activeSkuBudget = status.active_sku_budget;
  const phase = activeSkuBudget.phase;

  if (phase === "demo" || !activeSkuBudget.kind || activeSkuBudget.limit == null) {
    return (
      <div className="w-full max-w-[700px]">
        <div className="border p-6">
          <h6 className="text-foreground">SKU Usage</h6>
          <p className="mt-1 text-sm text-secondary">
            SKU limits are not enforced during demo access.
          </p>
        </div>
      </div>
    );
  }

  const description =
    phase === "trial"
      ? "During trial you can create up to 50 SKUs. When you subscribe, your paid SKU usage starts fresh."
      : "Track your SKU usage across billing periods.";
  const label =
    activeSkuBudget.kind === "trial"
      ? "trial SKUs used"
      : activeSkuBudget.kind === "onboarding"
        ? "onboarding SKUs used"
        : "new SKUs used this year";
  const infoTooltip =
    activeSkuBudget.kind === "onboarding" ? ONBOARDING_TOOLTIP : undefined;

  return (
    <div className="w-full max-w-[700px]">
      <div className="border p-6">
        <h6 className="text-foreground">SKU Usage</h6>
        <p className="mt-1 text-sm text-secondary">{description}</p>
        <div className="mt-4 space-y-4">
          <SkuUsageBar
            used={activeSkuBudget.used}
            limit={activeSkuBudget.limit}
            label={label}
            infoTooltip={infoTooltip}
          />
        </div>
      </div>
    </div>
  );
}
