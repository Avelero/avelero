"use client";

import { useTRPC } from "@/trpc/client";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { SkuUsageBar } from "./sku-usage-bar";

export function UsagePageContent() {
  const trpc = useTRPC();
  const initQuery = useQuery(trpc.composite.initDashboard.queryOptions());
  const sku = initQuery.data?.sku;

  if (!initQuery.data) {
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

  const hasAnnual = sku?.annual.limit != null;
  const hasOnboarding = sku?.onboarding.limit != null && sku.onboarding.limit > 0;

  if (!sku || (!hasAnnual && !hasOnboarding)) {
    return (
      <div className="w-full max-w-[700px]">
        <div className="border p-6">
          <p className="text-sm text-secondary">No usage data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[700px]">
      <div className="border p-6">
        <h6 className="text-foreground">SKU Usage</h6>
        <p className="mt-1 text-sm text-secondary">
          Track your SKU usage across billing periods.
        </p>
        <div className="mt-4 space-y-4">
          {hasAnnual && (
            <SkuUsageBar
              used={sku.annual.used}
              limit={sku.annual.limit!}
              label="new SKUs used this year"
            />
          )}
          {hasOnboarding && (
            <SkuUsageBar
              used={sku.onboarding.used}
              limit={sku.onboarding.limit!}
              label="onboarding SKUs used"
            />
          )}
        </div>
      </div>
    </div>
  );
}
