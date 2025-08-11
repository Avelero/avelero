import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import { BrandSwitcherClient } from "./brand-switcher-popover.client";

export async function BrandSwitcherPopover() {
  prefetch(trpc.brand.list.queryOptions());
  prefetch(trpc.user.me.queryOptions());
  return (
    <HydrateClient>
      <BrandSwitcherClient />
    </HydrateClient>
  );
}



