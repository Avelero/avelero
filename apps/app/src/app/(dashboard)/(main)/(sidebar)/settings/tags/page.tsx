import { TagsSection } from "@/components/settings/organization/tags-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsTagsPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.tags.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <TagsSection />
    </HydrateClient>
  );
}
