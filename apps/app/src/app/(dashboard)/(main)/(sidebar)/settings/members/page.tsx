import { MembersTable } from "@/components/tables/members/members";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function Page() {
  await connection();

  await prefetch(trpc.composite.membersWithInvites.queryOptions({}));

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <MembersTable />
      </div>
    </HydrateClient>
  );
}
