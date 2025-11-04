import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.composite.workflowInit.queryOptions());

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <Suspense fallback={<BrandsSkeleton />}>
          <BrandsTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
