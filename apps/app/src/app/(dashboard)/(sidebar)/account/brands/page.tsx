import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default function Page() {
  prefetch(trpc.workflow.list.queryOptions());
  prefetch(trpc.user.invites.list.queryOptions());

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
