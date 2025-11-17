import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();

  // Prefetch composite members + invites when active brand is available
  // User data is already hydrated from parent layout's workflowInit
  try {
    const user = await queryClient.fetchQuery(trpc.user.get.queryOptions());
    const brandId = user?.brand_id ?? null;

    if (brandId) {
      await queryClient.prefetchQuery(
        trpc.composite.membersWithInvites.queryOptions({
          brand_id: brandId,
        }),
      );
    }
  } catch {}

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <Suspense fallback={<MembersSkeleton />}>
          <MembersTable />
        </Suspense>
      </div>
    </HydrateClient>
  );
}
