import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { Suspense } from "react";
import { prefetch, HydrateClient, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function Page() {
  await connection();

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
