import { MaterialsSection } from "@/components/settings/catalog/materials-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsMaterialsPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.materials.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <MaterialsSection />
    </HydrateClient>
  );
}
