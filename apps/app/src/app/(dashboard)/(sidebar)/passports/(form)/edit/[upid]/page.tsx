import { EditPassportForm } from "@/components/passports/form/edit-passport-form";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  const { upid } = await params;
  const queryClient = getQueryClient();

  // Fetch passport data (critical for this page) - user already prefetched in layout
  // Following Midday's pattern: fetchQuery for page-specific critical data
  await queryClient.fetchQuery(trpc.passports.get.queryOptions({ upid }));

  // HydrateClient at page level to dehydrate page-specific data
  return (
    <HydrateClient>
      <EditPassportForm upid={upid} />
    </HydrateClient>
  );
}
