import { BrandsTable } from "@/components/tables/brands/brands";
import { HydrateClient, batchPrefetch, trpc } from "@/trpc/server";

export default async function Page() {
  // Prefetch memberships and invites for better UX
  await batchPrefetch([trpc.brand.list.queryOptions()]);
  await batchPrefetch([trpc.brand.myInvites.queryOptions()]);

  return (
    <HydrateClient>
      <div className="w-full max-w-[700px]">
        <BrandsTable />
      </div>
    </HydrateClient>
  );
}
