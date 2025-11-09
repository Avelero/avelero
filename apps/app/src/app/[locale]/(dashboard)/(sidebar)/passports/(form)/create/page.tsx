import { CreatePassportForm } from "@/components/passports/form/create-passport-form";

export default function CreatePassportsPage() {
  // No prefetching needed - creating a new passport with no initial data
  return <CreatePassportForm />;
}
