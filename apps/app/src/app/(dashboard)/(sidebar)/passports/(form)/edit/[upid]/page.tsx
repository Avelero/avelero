import { EditPassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { unstable_noStore } from "next/cache";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  return (
    <Suspense fallback={<PassportSkeleton title="Edit passport" />}>
      <EditPassportContent params={params} />
    </Suspense>
  );
}

async function EditPassportContent({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  
  const { upid } = await params;

  unstable_noStore();

  return (
    <HydrateClient>
      <EditPassportForm productUpid={upid} />
    </HydrateClient>
  );
}
