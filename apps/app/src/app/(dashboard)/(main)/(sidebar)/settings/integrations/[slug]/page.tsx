import { IntegrationDetail } from "@/components/integrations/integration-detail";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function IntegrationDetailPage({ params }: PageProps) {
  await connection();
  const { slug } = await params;

  batchPrefetch([
    trpc.integrations.connections.getBySlug.queryOptions({ slug }),
    trpc.integrations.connections.list.queryOptions({}),
  ]);

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <IntegrationDetail slug={slug} />
      </div>
    </HydrateClient>
  );
}
