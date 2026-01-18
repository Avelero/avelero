import { BrandsTable } from "@/components/tables/brands/brands";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function Page() {
  await connection();

  prefetch(trpc.user.invites.list.queryOptions());

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <BrandsTable />
      </div>
    </HydrateClient>
  );
}
