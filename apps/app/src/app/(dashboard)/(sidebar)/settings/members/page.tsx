import { MembersTable } from "@/components/tables/members/members";
import { MembersSkeleton } from "@/components/tables/members/skeleton";
import { prefetch,  trpc } from "@/trpc/server";
import { Suspense } from "react";

export default function Page() {
  prefetch(trpc.composite.membersWithInvites.queryOptions({}));

  return (
    <div className="w-full max-w-[700px]">
      <Suspense fallback={<MembersSkeleton />}>
        <MembersTable />
      </Suspense>
    </div>
  );
}
