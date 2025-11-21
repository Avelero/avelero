import { DataSectionContent, DataSectionSkeleton } from "@/components/passports/data-section";
import { TableSectionContent } from "@/components/passports/table-section";
import { TableSectionSkeleton } from "@/components/tables/passports/table-skeleton";
import { batchPrefetch, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default function PassportsPage() {
  batchPrefetch([
    trpc.summary.productStatus.queryOptions(),
    trpc.products.list.queryOptions({
      limit: 50,
      includeVariants: true,
    }),
    trpc.composite.brandCatalogContent.queryOptions(),
  ]);

  return (
      <div className="w-full">
        <div className="flex flex-col gap-12">
          <Suspense fallback={<DataSectionSkeleton />}>
            <DataSectionContent />
          </Suspense>
          <Suspense fallback={<TableSectionSkeleton />}>
            <TableSectionContent />
          </Suspense>
        </div>
      </div>
  );
}
