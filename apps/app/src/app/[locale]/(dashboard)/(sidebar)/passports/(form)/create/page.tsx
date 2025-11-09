import { CreatePassportForm } from "@/components/passports/form/create-passport-form";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function CreatePassportsPage() {
  const queryClient = getQueryClient();

  // Prefetch form reference data (materials, facilities, colors, sizes, etc.)
  // This ensures dropdowns are populated immediately when the form loads
  await queryClient.prefetchQuery(
    trpc.composite.passportFormReferences.queryOptions(),
  );

  return (
    <HydrateClient>
      <CreatePassportForm />
    </HydrateClient>
  );
}
