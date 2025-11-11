import { CreatePassportForm } from "@/components/forms/create-passport-form";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {
  const queryClient = getQueryClient();

  // Prefetch form reference data (categories, materials, facilities, colors, sizes, certifications, operators)
  await queryClient.prefetchQuery(
    trpc.composite.passportFormReferences.queryOptions()
  );

  return (
    <HydrateClient>
      <CreatePassportForm />
    </HydrateClient>
  );
}
