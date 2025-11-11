import {
  ControlBar,
  ControlBarLeft,
  ControlBarRight,
} from "@/components/control-bar";
import { PassportFormActions } from "@/components/passports/form-actions";
import { HydrateClient, getQueryClient, trpc } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Passports | Avelero",
};

export default async function PassportsFormLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();
  
  // Prefetch form reference data (categories, materials, facilities, colors, sizes, certifications, operators)
  await queryClient.prefetchQuery(
    trpc.composite.passportFormReferences.queryOptions()
  );

  return (
    <HydrateClient>
      <div className="flex flex-col h-full">
        <ControlBar>
          <ControlBarLeft />
          <ControlBarRight>
            <PassportFormActions />
          </ControlBarRight>
        </ControlBar>
        <div className="flex w-full h-full justify-center items-start p-12 overflow-y-auto scrollbar-hide">
          {children}
        </div>
      </div>
    </HydrateClient>
  );
}
