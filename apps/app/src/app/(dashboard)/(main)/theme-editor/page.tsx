import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { prefetch, HydrateClient, trpc } from "@/trpc/server";
import { ThemeEditorPage } from "@/components/theme-editor";
import { MainSkeleton } from "@/components/main-skeleton";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Theme Editor | Avelero",
};

export default async function Page() {
  await connection();

  prefetch(trpc.brand.theme.get.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<MainSkeleton />}>
        <ThemeEditorPage />
      </Suspense>
    </HydrateClient>
  );
}

