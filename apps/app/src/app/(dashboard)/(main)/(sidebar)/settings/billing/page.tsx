import { BillingPageContent } from "@/components/billing/billing-page-content";
import {
  HydrateClient,
  batchPrefetch,
  getQueryClient,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function BillingPage() {
  await connection();

  const queryClient = getQueryClient();
  const initDashboard = await queryClient.fetchQuery(
    trpc.composite.initDashboard.queryOptions(),
  );

  // Only accessible for brands with an active subscription.
  // Trial/expired brands use the plan selector overlay instead.
  const phase = initDashboard.access.phase;
  if (phase !== "active" && phase !== "past_due") {
    redirect("/settings");
  }

  batchPrefetch([
    trpc.brand.billing.getStatus.queryOptions(),
    trpc.brand.billing.getPortalUrl.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <BillingPageContent />
    </HydrateClient>
  );
}
