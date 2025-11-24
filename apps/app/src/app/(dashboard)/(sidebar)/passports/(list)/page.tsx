import { DataSection, DataSectionSkeleton } from "@/components/passports/data-section";
import { TableSection } from "@/components/passports/table-section";
import { TableSectionSkeleton } from "@/components/tables/passports/table-skeleton";
import { batchPrefetch, HydrateClient, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { connection } from "next/server";

export default async function PassportsPage() {
  await connection();

  batchPrefetch([
    trpc.summary.productStatus.queryOptions(),
    trpc.products.list.queryOptions({
      limit: 50,
      includeVariants: true,
    }),
    trpc.composite.brandCatalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-full">
        <div className="flex flex-col gap-12">
          <Suspense fallback={<DataSectionSkeleton />}>
            <DataSection />
          </Suspense>
          <Suspense fallback={<TableSectionSkeleton />}>
            <TableSection />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
