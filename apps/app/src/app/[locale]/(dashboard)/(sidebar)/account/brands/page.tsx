import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  // Prefetch memberships and invites for better UX
  await batchPrefetch([trpc.brand.list.queryOptions()]);
  await batchPrefetch([trpc.v2.user.invites.list.queryOptions()]);

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
