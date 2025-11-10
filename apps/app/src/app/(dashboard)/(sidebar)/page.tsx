import type { Metadata } from "next";
import { HydrateClient } from "@/trpc/server";
import { cookies } from "next/headers";

export const metadata: Metadata = {
  title: "Dashboard | Avelero",
};

export default async function DashboardPage() {
  // Mark this route as dynamic by accessing cookies (mirrors Midday's overview page).
  const cookieStore = await cookies();
  const hideConnectFlow = cookieStore.get("hide-connect-flow")?.value === "true";

  return (
    <HydrateClient>
      <div className="flex justify-center items-center relative">
        <div className="text-2xl font-bold">
          Dashboard {hideConnectFlow ? "" : ""}
        </div>
      </div>
    </HydrateClient>
  );
}
