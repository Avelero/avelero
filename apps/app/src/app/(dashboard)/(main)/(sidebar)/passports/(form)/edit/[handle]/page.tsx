import { EditProductForm } from "@/components/forms/passport";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
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

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  const { handle } = await params;

  batchPrefetch([
    trpc.products.get.queryOptions({
      handle,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.catalogContent.queryOptions(),
    trpc.brand.billing.getStatus.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <EditProductForm productHandle={handle} />
    </HydrateClient>
  );
}
