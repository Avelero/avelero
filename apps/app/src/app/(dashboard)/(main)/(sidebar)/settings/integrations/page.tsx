import { IntegrationsList } from "@/components/integrations/integrations-list";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Skeleton } from "@v1/ui/skeleton";
import { connection } from "next/server";
import { Suspense } from "react";

export default async function IntegrationsPage() {
  await connection();

  batchPrefetch([
    trpc.integrations.connections.listAvailable.queryOptions({}),
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
      {/* Connected integrations skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-[72px] w-full" />
          <Skeleton className="h-[72px] w-full" />
        </div>
      </div>

      {/* Available integrations skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-[180px]" />
          <Skeleton className="h-[180px]" />
        </div>
      </div>
    </div>
  );
}



