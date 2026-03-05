import { ThemeEditorPage } from "@/components/theme-editor";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { connection } from "next/server";
import "@v1/dpp-components/globals.css";

export const metadata: Metadata = {
  title: "Theme Editor | Avelero",
};

export default async function Page() {
  await connection();

  // Prefetch theme editor and header data for hydration on refresh.
  prefetch(trpc.brand.theme.get.queryOptions());
  prefetch(trpc.notifications.getUnreadCount.queryOptions());
  prefetch(
    trpc.notifications.getRecent.queryOptions({
      limit: 30,
      unreadOnly: false,
      includeDismissed: false,
    }),
  );

  return (
    <HydrateClient>
      <ThemeEditorPage />
    </HydrateClient>
  );
}
