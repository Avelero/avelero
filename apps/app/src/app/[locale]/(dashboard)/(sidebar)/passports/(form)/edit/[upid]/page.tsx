import { EditPassportForm } from "@/components/passports/form/edit-passport-form";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  const { upid } = await params;
  const queryClient = getQueryClient();

  // Prefetch passport data for instant rendering
  await queryClient.prefetchQuery(trpc.passports.get.queryOptions({ upid }));

  // No HydrateClient needed - parent layout already provides it
  return <EditPassportForm upid={upid} />;
}
