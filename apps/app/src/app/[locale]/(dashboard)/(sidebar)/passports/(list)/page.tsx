import { DataSection } from "@/components/passports/data-section";
import { TableSection } from "@/components/passports/table-section";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function PassportsPage() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(
    trpc.passports.list.queryOptions({
      page: 0,
      includeStatusCounts: true,
    }),
  );

  return (
    <HydrateClient>
      <div className="w-full">
        <div className="flex flex-col gap-12">
          <DataSection />
          <TableSection />
        </div>
      </div>
    </HydrateClient>
  );
}
