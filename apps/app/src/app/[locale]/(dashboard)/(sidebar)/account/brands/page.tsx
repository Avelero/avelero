import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();

  // Brands and invites data are already prefetched in sidebar layout via composite.workflowInit
  // Explicitly ensure they're available (this will use cached data if already present)
  await Promise.all([
    queryClient.prefetchQuery(trpc.workflow.list.queryOptions()),
    queryClient.prefetchQuery(trpc.user.invites.list.queryOptions()),
  ]);

  // No HydrateClient needed - parent layout already provides it
  return (
    <div className="w-full max-w-[700px]">
      <Suspense fallback={<BrandsSkeleton />}>
        <BrandsTable />
      </Suspense>
    </div>
  );
}
