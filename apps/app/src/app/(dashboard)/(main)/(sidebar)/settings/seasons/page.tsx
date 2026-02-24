import { SeasonsSection } from "@/components/settings/organization/seasons-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsSeasonsPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.seasons.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <SeasonsSection />
    </HydrateClient>
  );
}
