import { EditProductForm, ProductFormSkeleton } from "@/components/forms/passport";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await connection();

  const { handle } = await params;

  batchPrefetch([
    trpc.products.get.queryOptions({
      handle,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <Suspense fallback={<ProductFormSkeleton title="Edit passport" />}>
        <EditProductForm productHandle={handle} />
      </Suspense>
    </HydrateClient>
  );
}
