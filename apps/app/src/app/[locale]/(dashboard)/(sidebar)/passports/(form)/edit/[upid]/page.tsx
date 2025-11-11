import { EditPassportForm } from "@/components/forms/create-passport-form";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  const { upid } = await params;
  const queryClient = getQueryClient();

  // Prefetch form reference data (categories, materials, facilities, colors, sizes, certifications, operators)
  await queryClient.prefetchQuery(
    trpc.composite.passportFormReferences.queryOptions()
  );

  return (
    <HydrateClient>
      <EditPassportForm upid={upid} />
    </HydrateClient>
  );
}
