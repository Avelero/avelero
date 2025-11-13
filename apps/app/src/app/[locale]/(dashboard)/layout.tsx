import { getQueryClient, trpc, HydrateClient } from "@/trpc/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
  }: {
    children: React.ReactNode;
  }) {  
    const queryClient = getQueryClient();
    
    // Middleware already verified session exists
    // Fetch only basic user data (lightweight for /setup and /create-brand routes)
    const user = await queryClient.fetchQuery(
      trpc.user.get.queryOptions()
    );
    
    // This should never happen (middleware ensures session)
    // But good defensive programming
    if (!user) {
      redirect("/login");
    }
    
    return (
      <HydrateClient>
        {children}
      </HydrateClient>
    );
  }