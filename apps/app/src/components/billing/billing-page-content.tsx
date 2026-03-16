"use client";

import { useTRPC } from "@/trpc/client";
import { Button } from "@v1/ui/button";
import { Icons } from "@v1/ui/icons";
import { Skeleton } from "@v1/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { PLAN_DISPLAY, formatPrice, type PlanTier } from "./plan-features";

/** Format a date string deterministically to avoid hydration mismatches. */
function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDate().toString().padStart(2, "0");
  const month = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

export function BillingPageContent() {
  const trpc = useTRPC();

  const statusQuery = useQuery(trpc.brand.billing.getStatus.queryOptions());
  const portalQuery = useQuery(trpc.brand.billing.getPortalUrl.queryOptions());
  const invoicesQuery = useQuery(
    trpc.brand.billing.listInvoices.queryOptions(),
  );

  const status = statusQuery.data;

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

  const invoices = invoicesQuery.data ?? [];

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
                  {formatDate(status.current_period_end)}
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
                  ? formatDate(status.grace_ends_at)
                  : "the grace period ends"}
                .
              </p>
            )}
          </div>
          {portalQuery.data?.url ? (
            <Button
              variant="outline"
              onClick={() => {
                window.open(portalQuery.data?.url ?? "", "_blank");
              }}
            >
              Manage billing
            </Button>
          ) : null}
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
                {formatDate(inv.createdAt)}
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
            {portalQuery.data?.url ? (
              <Button
                variant="destructive"
                onClick={() => {
                  window.open(portalQuery.data?.url ?? "", "_blank");
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        )}
    </div>
  );
}

function formatInvoiceAmount(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbol = currency === "eur" ? "€" : currency === "usd" ? "$" : "";
  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}
