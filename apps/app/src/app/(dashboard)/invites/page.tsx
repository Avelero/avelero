import { BrandsTable } from "@/components/tables/brands/brands";
import { BrandsSkeleton } from "@/components/tables/brands/skeleton";
import { Header } from "@/components/header";
import { HydrateClient, prefetch, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Invites | Avelero",
};

export default async function Page() {
  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center overflow-y-auto scrollbar-hide">
          <div className="w-full max-w-[700px] space-y-6">
            <div className="text-center space-y-2">
              <h6 className="text-foreground">Join your brand</h6>
              <p className="text-secondary">
                Accept the invitation or create a new brand.
              </p>
            </div>
            <Suspense fallback={<BrandsSkeleton />}>
              <BrandsTable />
            </Suspense>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
