import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { prefetch, HydrateClient, trpc } from "@/trpc/server";
import { ThemeEditorLoader } from "@/components/theme-editor/theme-editor-loader";
import { MainSkeleton } from "@/components/main-skeleton";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Theme Editor | Avelero",
};

export default async function ThemeEditorPage() {
  await connection();

  prefetch(trpc.workflow.theme.get.queryOptions());

  return (
    <HydrateClient>
      <Suspense fallback={<MainSkeleton />}>
        <ThemeEditorLoader />
      </Suspense>
    </HydrateClient>
  );
}
