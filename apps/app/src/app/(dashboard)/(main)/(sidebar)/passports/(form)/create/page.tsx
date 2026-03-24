import { CreateProductForm } from "@/components/forms/passport";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  batchPrefetch([
    trpc.composite.catalogContent.queryOptions(),
    trpc.brand.billing.getStatus.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <CreateProductForm />
    </HydrateClient>
  );
}
