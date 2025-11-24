import { CreatePassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {
  await connection();

  prefetch(trpc.composite.brandCatalogContent.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<PassportSkeleton title="Create passport" />}>
        <CreatePassportForm />
      </Suspense>
    </HydrateClient>
  );
}
