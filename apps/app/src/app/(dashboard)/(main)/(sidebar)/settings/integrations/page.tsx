import { IntegrationsList } from "@/components/integrations/integrations-list";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Skeleton } from "@v1/ui/skeleton";
import { connection } from "next/server";
import { Suspense } from "react";

export default async function IntegrationsPage() {
  await connection();

  batchPrefetch([
    trpc.integrations.connections.list.queryOptions({}),
  ]);

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <Suspense fallback={<IntegrationsListSkeleton />}>
          <IntegrationsList />
        </Suspense>
      </div>
    </HydrateClient>
  );
}

function IntegrationsListSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-[98px] w-full" />
          <Skeleton className="h-[98px] w-full" />
          <Skeleton className="h-[98px] w-full" />
        </div>
      </div>
    </div>
  );
}
