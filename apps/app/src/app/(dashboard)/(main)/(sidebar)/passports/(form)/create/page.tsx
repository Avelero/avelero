import { CreateProductForm } from "@/components/forms/passport";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";

export const metadata: Metadata = {
  title: "Create passport | Avelero",
};

export default async function CreatePassportsPage() {
  await connection();

  await prefetch(trpc.composite.catalogContent.queryOptions());

  return (
    <HydrateClient>
      <CreateProductForm />
    </HydrateClient>
  );
}
