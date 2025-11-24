import { EditPassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
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
  params: Promise<{ upid: string }>;
}) {
  await connection();

  const { upid } = await params;

  batchPrefetch([
    trpc.products.getByUpid.queryOptions({
      upid,
      includeVariants: true,
      includeAttributes: true,
    }),
    trpc.composite.brandCatalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <Suspense fallback={<PassportSkeleton title="Edit passport" />}>
        <EditPassportForm productUpid={upid} />
      </Suspense>
    </HydrateClient>
  );
}
