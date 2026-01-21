import { SetupForm, SetupFormSkeleton } from "@/components/forms/setup-form";
import { Header } from "@/components/header";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Setup | Avelero",
};

export default async function Page() {
  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
          <Suspense fallback={<SetupFormSkeleton />}>
            <SetupForm />
          </Suspense>
        </div>
      </div>
    </HydrateClient>
  );
}
