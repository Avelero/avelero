import { IntegrationDetail } from "@/components/integrations/integration-detail";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Skeleton } from "@v1/ui/skeleton";
import { connection } from "next/server";
import { Suspense } from "react";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function IntegrationDetailPage({ params }: PageProps) {
  await connection();
  const { slug } = await params;

  batchPrefetch([
    trpc.integrations.connections.getBySlug.queryOptions({ slug }),
    trpc.integrations.connections.listAvailable.queryOptions({}),
  ]);

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <Suspense fallback={<IntegrationDetailSkeleton />}>
          <IntegrationDetail slug={slug} />
        </Suspense>
      </div>
    </HydrateClient>
  );
}

function IntegrationDetailSkeleton() {
  return (
    <div className="space-y-8">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-9 w-24" />
      </div>

      {/* Status section skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-3 gap-4">
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
          <Skeleton className="h-[72px]" />
        </div>
      </div>

      {/* Field mappings skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-[300px]" />
      </div>

      {/* Sync history skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-[200px]" />
      </div>
    </div>
  );
}




