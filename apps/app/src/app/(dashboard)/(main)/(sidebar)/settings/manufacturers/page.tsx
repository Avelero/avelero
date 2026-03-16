import { ManufacturersSection } from "@/components/settings/catalog/manufacturers-section";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsManufacturersPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  batchPrefetch([
    trpc.catalog.manufacturers.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <ManufacturersSection />
    </HydrateClient>
  );
}
