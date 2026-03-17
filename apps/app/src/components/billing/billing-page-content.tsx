"use client";

/**
 * Renders the customer-facing billing page with plan status, invoices, and billing actions.
 */
import { formatBillingDate } from "@/lib/format-billing-date";
import { useTRPC } from "@/trpc/client";
import { usePlanSelector } from "@/components/billing/plan-selector-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@v1/ui/button";
import { Skeleton } from "@v1/ui/skeleton";
import { toast } from "@v1/ui/sonner";
import { PLAN_DISPLAY, formatPrice, type PlanTier } from "./plan-features";

export function BillingPageContent() {
  // Reuse the shared plan-selector overlay instead of introducing a second billing modal.
  const trpc = useTRPC();
  const { open: openPlanSelector } = usePlanSelector();

  const statusQuery = useQuery(trpc.brand.billing.getStatus.queryOptions());
  const invoicesQuery = useQuery(
    trpc.brand.billing.listInvoices.queryOptions(),
  );
  const portalMutation = useMutation(
    trpc.brand.billing.getPortalUrl.mutationOptions({
      onError: () => {
        toast.error("Failed to open billing portal");
      },
    }),
  );

  const status = statusQuery.data;

  // Handle billing-status failures explicitly so the page does not get stuck in a loading skeleton.
  // Only show the error state when there is no cached data; a background refetch error should not
  // hide previously loaded billing details.
  if (statusQuery.isError && !status) {
    return (
      <div className="w-full max-w-[700px] border p-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <h6 className="text-foreground">Billing unavailable</h6>
            <p className="text-sm text-secondary">
              We could not load your current billing status. Please try again.
            </p>
          </div>
          <div>
            <Button
              variant="outline"
              onClick={() => void statusQuery.refetch()}
              disabled={statusQuery.isFetching}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="w-full max-w-[700px] flex flex-col gap-12">
        {/* Plan overview skeleton */}
        <div className="border">
          <div className="flex items-start justify-between gap-6 p-6">
            <div className="flex flex-col gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-9 w-[120px]" />
          </div>
        </div>

        {/* Invoices skeleton */}
        <div className="border">
          <div className="p-6">
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="grid grid-cols-4">
            {["Date", "Total", "Status", "Actions"].map((col) => (
              <div
                key={col}
                className="bg-accent-light px-4 py-2 border-y border-border"
              >
                <Skeleton className="h-3.5 w-12" />
              </div>
            ))}
          </div>
          {["a", "b", "c"].map((key) => (
            <div
              key={key}
              className="grid grid-cols-4 border-b border-border last:border-b-0"
            >
              <div className="px-4 py-2.5">
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="px-4 py-2.5">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="px-4 py-2.5">
                <Skeleton className="h-4 w-12" />
              </div>
              <div className="px-4 py-2.5 flex justify-end">
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
          ))}
        </div>

        {/* Cancel section skeleton */}
        <div className="flex items-center justify-between border p-6">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-20" />
        </div>
      </div>
    );
  }

  const tier = status.plan_type as PlanTier;
  const display = PLAN_DISPLAY[tier];
  const interval = status.billing_interval as "monthly" | "yearly" | null;
  const basePrice =
    interval === "yearly" ? display?.yearlyPrice : display?.monthlyPrice;
  const periodLabel = interval === "yearly" ? "/year" : "/month";
  const showPlanSelectorButton = status.billing_mode === "stripe_checkout";
  const planSelectorLabel = status.pending_cancellation ? "Renew" : "Upgrade";
  const canManageBilling = !!status.stripe_customer_id;

  const invoices = invoicesQuery.data ?? [];
  const openBillingPortal = async () => {
    // Create the short-lived portal session only when the user explicitly asks for it.
    const portal = await portalMutation.mutateAsync();
    if (!portal.url) {
      toast.error("No billing portal is available for this brand yet.");
      return;
    }

    window.open(portal.url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="w-full max-w-[700px] flex flex-col gap-12">
      {/* Plan overview */}
      <div className="border">
        <div className="flex items-start justify-between gap-6 p-6">
          <div className="flex flex-col gap-1.5">
            <h6 className="text-foreground">
              {display?.name ?? status.plan_type} Plan
            </h6>
            {basePrice != null && (
              <p className="text-sm text-secondary">
                {formatPrice(basePrice)}
                {periodLabel}
              </p>
            )}
            {status.current_period_end && (
              <p className="text-sm text-secondary">
                {status.pending_cancellation
                  ? "Your plan will end on "
                  : "Your subscription will auto renew on "}
                <span className="text-primary">
                  {formatBillingDate(status.current_period_end) ??
                    status.current_period_end}
                </span>
                .
              </p>
            )}
            {status.sku_annual_limit != null && (
              <p className="text-sm text-secondary">
                {status.sku_annual_limit.toLocaleString("en-US")} product
                passports per year
              </p>
            )}
            {status.phase === "past_due" && (
              <p className="text-sm text-destructive">
                Payment is past due. Update your payment method before{" "}
                {status.grace_ends_at
                  ? (formatBillingDate(status.grace_ends_at) ??
                    status.grace_ends_at)
                  : "the grace period ends"}
                .
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showPlanSelectorButton ? (
              <Button onClick={openPlanSelector}>{planSelectorLabel}</Button>
            ) : null}
            {canManageBilling ? (
              <Button
                variant="outline"
                onClick={() => void openBillingPortal()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? "Opening..." : "Manage billing"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Invoices */}
      <div className="border">
        <div className="p-6">
          <h6 className="text-foreground">Invoices</h6>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-4">
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Date
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Total
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border">
            Status
          </div>
          <div className="bg-accent-light px-4 py-2 type-small text-secondary border-y border-border text-right">
            Actions
          </div>
        </div>

        {/* Table rows */}
        {invoicesQuery.isLoading ? (
          <>
            {["a", "b"].map((key) => (
              <div
                key={key}
                className="grid grid-cols-4 border-b border-border last:border-b-0"
              >
                <div className="px-4 py-2.5">
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="px-4 py-2.5">
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="px-4 py-2.5">
                  <Skeleton className="h-4 w-12" />
                </div>
                <div className="px-4 py-2.5 flex justify-end">
                  <Skeleton className="h-4 w-8" />
                </div>
              </div>
            ))}
          </>
        ) : invoices.length === 0 ? (
          <div className="flex items-center justify-center h-[120px]">
            <p className="type-p text-tertiary">No invoices yet</p>
          </div>
        ) : (
          invoices.map((inv) => (
            <div
              key={inv.id}
              className="grid grid-cols-4 border-b border-border last:border-b-0"
            >
              <div className="px-4 py-2.5 type-p text-primary">
                {formatBillingDate(inv.createdAt) ?? inv.createdAt}
              </div>
              <div className="px-4 py-2.5 type-p text-primary">
                {inv.total != null
                  ? formatInvoiceAmount(inv.total, inv.currency)
                  : "—"}
              </div>
              <div className="px-4 py-2.5 type-p text-primary">
                {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
              </div>
              <div className="px-4 py-2.5 text-right">
                {inv.hostedInvoiceUrl && (
                  <a
                    href={inv.hostedInvoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-p text-primary underline underline-offset-2"
                  >
                    View
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cancellation */}
      {(status.phase === "active" || status.phase === "past_due") &&
        !status.pending_cancellation && (
          <div className="flex items-center justify-between border p-6">
            <div>
              <h6 className="text-foreground">Cancel plan</h6>
              <p className="mt-1 text-sm text-secondary">
                Cancel your subscription at the end of the current billing
                period.
              </p>
            </div>
            {canManageBilling ? (
              <Button
                variant="destructive"
                onClick={() => void openBillingPortal()}
                disabled={portalMutation.isPending}
              >
                {portalMutation.isPending ? "Opening..." : "Cancel"}
              </Button>
            ) : null}
          </div>
        )}
    </div>
  );
}

function formatInvoiceAmount(cents: number, currency: string): string {
  // Keep invoice amounts human-readable without pulling in a heavier currency formatter here.
  const amount = cents / 100;
  const symbol = currency === "eur" ? "€" : currency === "usd" ? "$" : "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
