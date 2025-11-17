import { EditPassportForm } from "@/components/forms/create-passport-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit passport | Avelero",
};

export default async function EditPassportPage({
  params,
}: {
  params: Promise<{ upid: string }>;
}) {
  const { upid } = await params;
  return <EditPassportForm productUpid={upid} />;
}
