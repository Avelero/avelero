import { OperatorsSection } from "@/components/settings/catalog/operators-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsOperatorsPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.operators.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <OperatorsSection />
    </HydrateClient>
  );
}
