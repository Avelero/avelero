import { BillingPageContent } from "@/components/billing/billing-page-content";
import { getDashboardInit, shouldBlockSidebarContent } from "@/lib/brand-access";
import {
  HydrateClient,
  batchPrefetch,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function BillingPage() {
  await connection();

  if (await shouldBlockSidebarContent()) {
    return null;
  }

  const init = await getDashboardInit();
  const phase = init.access.phase;
  if (phase === "demo" || phase === "trial") {
    redirect("/settings");
  }

  batchPrefetch([
    trpc.brand.billing.getStatus.queryOptions(),
    trpc.brand.billing.getPortalUrl.queryOptions(),
    trpc.brand.billing.listInvoices.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <BillingPageContent />
    </HydrateClient>
  );
}
