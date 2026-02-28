import { BlockedAccessScreen } from "@/components/access/blocked-access-screen";
import { PastDueBanner } from "@/components/access/past-due-banner";
import { PaymentRequiredOverlay } from "@/components/access/payment-required-overlay";
import { getQueryClient, trpc } from "@/trpc/server";
import { redirect } from "next/navigation";
import { connection } from "next/server";

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
  // Signal that this component needs request-time data.
  await connection();

  const queryClient = getQueryClient();

  // Fetch data (will use cached result from parent layout's bootstrap)
  const initDashboard = await queryClient.fetchQuery(
    trpc.composite.initDashboard.queryOptions(),
  );

  const user = initDashboard.user;
  const brands = initDashboard.brands;
  const invites = initDashboard.myInvites;
  const access = initDashboard.access;

  // Redirect logic for incomplete users
  // These destinations are OUTSIDE (main), so no infinite loops
  if (!user?.full_name) {
    redirect("/setup");
  }

  if (brands.length === 0 && invites.length === 0) {
    redirect("/pending-access");
  }

  if (brands.length === 0 && invites.length > 0) {
    redirect("/invites");
  }

  if (access.overlay === "suspended" || access.overlay === "cancelled") {
    return <BlockedAccessScreen reason={access.overlay} />;
  }

  return (
    <div className="relative h-full min-h-0">
      {access.banner === "past_due" ? <PastDueBanner /> : null}
      <div className="relative h-full min-h-0">
        {children}
        {access.overlay === "payment_required" ? <PaymentRequiredOverlay /> : null}
      </div>
    </div>
  );
}
