import { EditProductForm } from "@/components/forms/passport";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";

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

  await batchPrefetch([
    trpc.products.get.queryOptions({
      handle,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <EditProductForm productHandle={handle} />
    </HydrateClient>
  );
}
