import { DataSection } from "@/components/passports/data-section";
import { TableSection } from "@/components/passports/table-section";
import { getQueryClient, trpc } from "@/trpc/server";

export default async function PassportsPage() {
  const queryClient = getQueryClient();

  await Promise.allSettled([
    queryClient.prefetchQuery(
      trpc.products.list.queryOptions({
        limit: 50,
        includeVariants: true,
      }),
    ),
    queryClient.prefetchQuery(trpc.summary.productStatus.queryOptions()),
    queryClient.prefetchQuery(trpc.composite.brandCatalogContent.queryOptions()),
  ]);

  return (
    <div className="w-full">
      <div className="flex flex-col gap-12">
        <DataSection />
        <TableSection />
      </div>
    </div>
  );
}
