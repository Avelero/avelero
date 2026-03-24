import { AttributesSection } from "@/components/settings/organization/attributes-section";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsAttributesPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  batchPrefetch([
    trpc.catalog.attributes.listGrouped.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <AttributesSection />
    </HydrateClient>
  );
}
