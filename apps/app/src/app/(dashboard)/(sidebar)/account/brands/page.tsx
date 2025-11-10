import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { Suspense } from "react";

export default function Page() {
  // No data fetching needed - all data (user, workflow, invites) prefetched in layout
  // Following Midday's pattern: simple pages don't need HydrateClient
  return (
    <div className="w-full max-w-[700px]">
      <Suspense fallback={<BrandsSkeleton />}>
        <BrandsTable />
      </Suspense>
    </div>
  );
}
