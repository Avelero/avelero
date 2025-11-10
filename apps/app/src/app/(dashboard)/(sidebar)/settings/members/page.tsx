import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import { Suspense } from "react";

export default async function Page() {
  const queryClient = getQueryClient();

  // Get brand_id from user data (already prefetched in layout)
  const user = queryClient.getQueryData(trpc.user.get.queryKey());
  const brandId = user?.brand_id ?? null;

  // Fetch members data for this specific page (blocking - critical data)
  // Following Midday's pattern: use fetchQuery for critical page-specific data
  if (brandId) {
    await queryClient.fetchQuery(
      trpc.composite.membersWithInvites.queryOptions({
        brand_id: brandId,
      }),
    );
  }

  // HydrateClient at page level to dehydrate page-specific data
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
