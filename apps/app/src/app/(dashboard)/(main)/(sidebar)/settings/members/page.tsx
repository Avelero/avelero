import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { prefetch, HydrateClient, trpc } from "@/trpc/server";
import { Suspense } from "react";
import { connection } from "next/server";

export default async function Page() {
  await connection();

  prefetch(trpc.composite.membersWithInvites.queryOptions({}));

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
