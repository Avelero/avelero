import { CreatePassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {

  return (
    <Suspense fallback={<PassportSkeleton title="Create passport" />}>
      <CreatePassportForm />
    </Suspense>
  );
}
