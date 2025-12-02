import { getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";

/**
 * Main App Layout - Redirect Logic
 * 
 * This layout enforces that users have completed onboarding before
 * accessing the main application pages. It redirects incomplete users
 * to the appropriate onboarding page.
 * 
 * Auth bootstrap is handled by the parent (dashboard)/layout.tsx.
 * Header/Sidebar rendering is handled by child (sidebar)/layout.tsx.
 */
export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  // Fetch data (will use cached result from parent layout's bootstrap)
  const workflowInit = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions(),
  );

  const user = workflowInit.user;
  const brands = workflowInit.brands;
  const invites = workflowInit.myInvites;

  // Redirect logic for incomplete users
  // These destinations are OUTSIDE (main), so no infinite loops
  if (!user?.full_name) {
    redirect("/setup");
  }

  if (brands.length === 0 && invites.length === 0) {
    redirect("/create-brand");
  }

  if (brands.length === 0 && invites.length > 0) {
    redirect("/invites");
  }

  return children;
}
