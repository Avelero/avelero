import { VariantForm, VariantFormSkeleton } from "@/components/forms/passport";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Edit Variant | Avelero",
};

export default async function VariantEditPage({
  params,
}: {
  params: Promise<{ handle: string; upid: string }>;
}) {
  await connection();

  const { handle, upid } = await params;

  batchPrefetch([
    trpc.products.variants.getOverrides.queryOptions({
      productHandle: handle,
      variantUpid: upid,
    }),
    trpc.products.get.queryOptions({
      handle,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <Suspense fallback={<VariantFormSkeleton />}>
        <VariantForm productHandle={handle} variantUpid={upid} />
      </Suspense>
    </HydrateClient>
  );
}
