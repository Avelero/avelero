import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { Suspense } from "react";
import { prefetch, trpc } from "@/trpc/server";

export default function Page() {
  prefetch(trpc.user.invites.list.queryOptions());

  return (
    <div className="w-full max-w-[700px]">
      <Suspense fallback={<BrandsSkeleton />}>
        <BrandsTable />
      </Suspense>
    </div>
  );
}
