import { CheckoutReturnHandler } from "@/components/billing/checkout-success-toast";
import { BillingPageContent } from "@/components/billing/billing-page-content";
import { getDashboardInit, shouldBlockSidebarContent } from "@/lib/brand-access";
import {
  HydrateClient,
  batchPrefetch,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string | string[]; pack?: string | string[] }>;
}) {
  await connection();

  if (await shouldBlockSidebarContent()) {
    return null;
  }

  const init = await getDashboardInit();
  const phase = init.access.phase;
  const resolvedSearchParams = await searchParams;
  const checkoutParam = resolvedSearchParams.checkout;
  const hasCheckoutReturn = Array.isArray(checkoutParam)
    ? checkoutParam.length > 0
    : typeof checkoutParam === "string" && checkoutParam.length > 0;

  if (phase === "demo" || (phase === "trial" && !hasCheckoutReturn)) {
    redirect("/settings");
  }

  batchPrefetch([
    trpc.brand.billing.getStatus.queryOptions(),
    trpc.brand.billing.listInvoices.queryOptions(),
  ]);

  if (phase === "trial" && hasCheckoutReturn) {
    // Do NOT mount CheckoutReturnHandler here — it clears ?checkout immediately,
    // which causes the server to re-evaluate while phase is still "trial" and
    // redirect the user to /settings before billing status updates.
    // The toast will be shown once the phase transitions and the normal branch renders.
    return (
      <HydrateClient>
        <div className="w-full max-w-[700px] border p-6">
          <div className="flex flex-col gap-1.5">
            <h6 className="text-foreground">Finalizing billing</h6>
            <p className="text-sm text-secondary">
              We&apos;re waiting for your billing status to refresh.
            </p>
          </div>
        </div>
      </HydrateClient>
    );
  }

  return (
    <HydrateClient>
      <CheckoutReturnHandler />
      <BillingPageContent />
    </HydrateClient>
  );
}
