import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";
import { BrandsTable } from "@/components/tables/brands/brands";

export default async function Page() {
  // Prefetch memberships and invites for better UX
  batchPrefetch([
    trpc.brand.list.queryOptions(),
    trpc.brand.myInvites.queryOptions(),
  ]);

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <BrandsTable />
      </div>
    </HydrateClient>
  );
}


