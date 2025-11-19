import { EditPassportForm } from "@/components/forms/passport/create-passport-form";
import { PassportSkeleton } from "@/components/forms/passport/skeleton";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  const { upid } = await params;
  return (
    <Suspense fallback={<PassportSkeleton title="Edit passport" />}>
      <EditPassportForm productUpid={upid} />
    </Suspense>
  );
}
