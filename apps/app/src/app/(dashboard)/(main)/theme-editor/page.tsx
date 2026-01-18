import type { Metadata } from "next";
import { connection } from "next/server";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { ThemeEditorPage } from "@/components/theme-editor";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Theme Editor | Avelero",
};

export default async function Page() {
  await connection();

  prefetch(trpc.brand.theme.get.queryOptions());

  return (
    <HydrateClient>
      <ThemeEditorPage />
    </HydrateClient>
  );
}
