import { MembersTable } from "@/components/tables/members/members";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function Page() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  prefetch(trpc.composite.membersWithInvites.queryOptions({}));

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <MembersTable />
      </div>
    </HydrateClient>
  );
}
