import { Header } from "@/components/header";
import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Invites | Avelero",
};

export default async function Page() {
  const queryClient = getQueryClient();
  const [brands, invites] = await Promise.all([
    queryClient.fetchQuery(trpc.user.brands.list.queryOptions()),
    queryClient.fetchQuery(trpc.user.invites.list.queryOptions()),
  ]);

  const hasBrands = Array.isArray(brands) && brands.length > 0;
  const hasInvites = Array.isArray(invites) && invites.length > 0;
  if (hasBrands || !hasInvites) {
    redirect("/");
  }

  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center overflow-y-auto scrollbar-hide">
          <div className="w-full max-w-[700px] space-y-6">
            <div className="text-center space-y-2">
              <h6 className="text-foreground">Join your brand</h6>
              <p className="text-secondary">
                Accept an invitation to access your workspace.
              </p>
            </div>
            <Suspense fallback={<BrandsSkeleton invitesOnly />}>
              <BrandsTable invitesOnly />
            </Suspense>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
