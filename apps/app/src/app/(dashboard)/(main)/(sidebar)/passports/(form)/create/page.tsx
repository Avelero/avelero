import {
  CreateProductForm,
  ProductFormSkeleton,
} from "@/components/forms/passport";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {
  await connection();

  prefetch(trpc.composite.catalogContent.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<ProductFormSkeleton title="Create passport" />}>
        <CreateProductForm />
      </Suspense>
    </HydrateClient>
  );
}
