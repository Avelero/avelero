import { DataSection } from "@/components/passports/data-section";
import { TableSection } from "@/components/passports/table-section";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function PassportsPage() {
  const queryClient = getQueryClient();

  // Fetch passports list (critical for this page) - user already prefetched in layout
  // Following Midday's pattern: fetchQuery for page-specific critical data
  await queryClient.fetchQuery(
    trpc.passports.list.queryOptions({ includeStatusCounts: true }),
  );

  // HydrateClient at page level to dehydrate page-specific data
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
