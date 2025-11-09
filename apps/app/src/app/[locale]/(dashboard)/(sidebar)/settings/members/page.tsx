import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();

  // Get brand_id from cached user data (already prefetched in sidebar layout)
  const user = queryClient.getQueryData(trpc.user.get.queryKey());
  const brandId = user?.brand_id ?? null;

  if (brandId) {
    // Prefetch members and invites for the active brand
    await queryClient.prefetchQuery(
      trpc.composite.membersWithInvites.queryOptions({
        brand_id: brandId,
      }),
    );
  }

  // No HydrateClient needed - parent layout already provides it
  return (
    <div className="w-full max-w-[700px]">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersTable />
      </Suspense>
    </div>
  );
}
