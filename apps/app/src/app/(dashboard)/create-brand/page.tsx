import { CreateBrandForm, CreateBrandFormSkeleton } from "@/components/forms/create-brand-form";
import { Header } from "@/components/header";
import { getQueryClient, HydrateClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Create a brand | Avelero",
};

export default async function Page() {
  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
          <Suspense fallback={<CreateBrandFormSkeleton />}>
            <CreateBrandForm />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
