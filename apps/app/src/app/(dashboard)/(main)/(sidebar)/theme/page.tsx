import { SetTheme } from "@/components/design/set-theme";
import { shouldBlockSidebarContent } from "@/lib/brand-access";
import { HydrateClient, getQueryClient, prefetch, trpc } from "@/trpc/server";
import { connection } from "next/server";

export default async function DesignPage() {
  await connection();

  // Skip page prefetches when the active brand is blocked.
  if (await shouldBlockSidebarContent()) {
    return null;
  }

  prefetch(trpc.brand.theme.get.queryOptions());

  // Fetch theme data to pass updatedAt prop
  const queryClient = getQueryClient();
  const theme = await queryClient.fetchQuery(
    trpc.brand.theme.get.queryOptions(),
  );

  return (
    <HydrateClient>
      <div className="max-w-[700px] w-full">
        <div className="flex flex-col gap-12">
          <SetTheme updatedAt={theme.updatedAt ?? new Date().toISOString()} />
        </div>
      </div>
    </HydrateClient>
  );
}
