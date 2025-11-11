import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { HydrateClient } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  // workflowInit is already prefetched in parent layout
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
