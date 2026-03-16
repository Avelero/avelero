import { UsagePageContent } from "@/components/billing/usage-page-content";
import { getDashboardInit, shouldBlockSidebarContent } from "@/lib/brand-access";
import {
  HydrateClient,
  prefetch,
  trpc,
} from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

export default async function UsagePage() {
  await connection();

  if (await shouldBlockSidebarContent()) {
    return null;
  }

  const init = await getDashboardInit();
  const phase = init.access.phase;
  if (phase === "demo" || phase === "trial") {
    redirect("/settings");
  }

  prefetch(trpc.composite.initDashboard.queryOptions());

  return (
    <HydrateClient>
      <UsagePageContent />
    </HydrateClient>
  );
}
