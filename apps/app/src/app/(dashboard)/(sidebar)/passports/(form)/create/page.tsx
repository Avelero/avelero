import { CreatePassportForm } from "@/components/passports/form/create-passport-form";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";

export default async function CreatePassportsPage() {
  const queryClient = getQueryClient();

  // Fetch form reference data (critical for this page) - user already prefetched in layout
  // Following Midday's pattern: fetchQuery for page-specific critical data
  await queryClient.fetchQuery(
    trpc.composite.passportFormReferences.queryOptions(),
  );

  // HydrateClient at page level to dehydrate page-specific data
  return (
    <HydrateClient>
      <CreatePassportForm />
    </HydrateClient>
  );
}
