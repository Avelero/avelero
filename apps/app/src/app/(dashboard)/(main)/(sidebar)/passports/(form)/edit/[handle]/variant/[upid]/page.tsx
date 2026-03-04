import { VariantForm } from "@/components/forms/passport";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";

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
      <VariantForm productHandle={handle} variantUpid={upid} />
    </HydrateClient>
  );
}
