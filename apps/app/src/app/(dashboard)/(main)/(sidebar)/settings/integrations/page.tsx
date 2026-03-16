import { IntegrationsList } from "@/components/integrations/integrations-list";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function IntegrationsPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  // Single query, use prefetch instead of batchPrefetch
  prefetch(trpc.integrations.connections.list.queryOptions({}));

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <IntegrationsList />
      </div>
    </HydrateClient>
  );
}
