import { ManufacturersSection } from "@/components/settings/catalog/manufacturers-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsManufacturersPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.manufacturers.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <ManufacturersSection />
    </HydrateClient>
  );
}
