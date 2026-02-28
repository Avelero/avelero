import { Header } from "@/components/header";
import { HydrateClient } from "@/trpc/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pending Access | Avelero",
};

export default function Page() {
  return (
    <HydrateClient>
      <div className="h-full w-full">
        <Header hideUserMenu disableLogoLink />
        <div className="h-[calc(100%-112px)] w-full flex justify-center items-center px-6">
          <div className="w-full max-w-[640px] border p-6 space-y-2 text-center">
            <h6 className="text-foreground">Access pending</h6>
            <p className="text-secondary">
              Your account is active, but you do not have access to a brand yet.
              Ask your workspace owner to send you an invitation.
            </p>
          </div>
        </div>
      </div>
    </HydrateClient>
  );
}
