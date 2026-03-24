import { SeasonsSection } from "@/components/settings/organization/seasons-section";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsSeasonsPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  batchPrefetch([
    trpc.catalog.seasons.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <SeasonsSection />
    </HydrateClient>
  );
}
