import { CertificationsSection } from "@/components/settings/catalog/certifications-section";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function SettingsCertificationsPage() {
  await connection();

  await batchPrefetch([
    trpc.catalog.certifications.list.queryOptions(undefined),
    trpc.composite.catalogContent.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <CertificationsSection />
    </HydrateClient>
  );
}
