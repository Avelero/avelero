import { AttributesSection } from "@/components/settings/organization/attributes-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsAttributesPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.attributes.listGrouped.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <AttributesSection />
    </HydrateClient>
  );
}
