/**
 * Server page for the billing usage view.
 */
import { UsagePageContent } from "@/components/billing/usage-page-content";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import {
  HydrateClient,
  getQueryClient,
  trpc,
} from "@/trpc/server";
import { connection } from "next/server";

export default async function UsagePage() {
  // Prefetch billing status so the usage panel hydrates with the latest plan limits.
  await connection();

  if (await shouldBlockSidebarContent()) {
    return null;
  }

  // Resolve the usage query before dehydration so the client does not hydrate
  // from a pending state while the server rendered the completed payload.
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(
    trpc.brand.billing.getStatus.queryOptions(),
  );

  return (
    <HydrateClient>
      <UsagePageContent />
    </HydrateClient>
  );
}
