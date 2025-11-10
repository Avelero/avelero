import { SetupForm } from "@/components/forms/setup-form";
import { getQueryClient, trpc } from "@/trpc/server";
import { HydrateClient } from "@/trpc/server";
import { Header } from "@/components/header";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Setup | Avelero",
};

export const dynamic = "force-dynamic"; // To-do: Remove this once we have a proper solution for data hydration.

export default async function Page() {
  const queryClient = getQueryClient();
  const user = await queryClient.fetchQuery(trpc.user.get.queryOptions());

  if (!user?.id) {
    redirect("/");
  }

  return (
    <div className="h-full w-full">
      <Header hideUserMenu disableLogoLink />
      <div className="h-[calc(100%-112px)] w-full flex justify-center items-center">
        <HydrateClient>
          <SetupForm />
        </HydrateClient>
      </div>
    </div>
  );
}