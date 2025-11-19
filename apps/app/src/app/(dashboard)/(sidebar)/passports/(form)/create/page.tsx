import { CreatePassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import { prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default function CreatePassportsPage() {
  prefetch(trpc.composite.brandCatalogContent.queryOptions());

  return (
    <Suspense fallback={<PassportSkeleton title="Create passport" />}>
      <CreatePassportForm />
    </Suspense>
  );
}
