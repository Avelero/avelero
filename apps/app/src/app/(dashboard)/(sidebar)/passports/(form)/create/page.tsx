import { CreatePassportForm } from "@/components/passports/form/create-passport-form";
import { HydrateClient } from "@/trpc/server";

export default function CreatePassportsPage() {
  return (
    <HydrateClient>
      <CreatePassportForm />
    </HydrateClient>
  );
}
