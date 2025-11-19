import { EditPassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import { batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default function EditPassportPage({
  params,
}: {
  params: { upid: string };
}) {
  const { upid } = params;

  batchPrefetch([
    trpc.composite.brandCatalogContent.queryOptions(),
    trpc.products.getByUpid.queryOptions({
      upid,
      includeVariants: true,
      includeAttributes: true,
    }),
  ]);

  return (
    <Suspense fallback={<PassportSkeleton title="Edit passport" />}>
      <EditPassportForm productUpid={upid} />
    </Suspense>
  );
}
