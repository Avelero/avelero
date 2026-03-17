import { PastDueBanner } from "@/components/access/past-due-banner";
import { PendingCancellationBanner } from "@/components/access/pending-cancellation-banner";
import {
  INVITE_REQUIRED_LOGIN_PATH,
  getForceSignOutPath,
} from "@/lib/auth-access";
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

  // The auth session can briefly outlive the app profile row (for example,
  // immediately after account deletion). Treat this as an invalid session.
  if (!user) {
    redirect("/login");
  }

  // Redirect logic for incomplete users
  // These destinations are OUTSIDE (main), so no infinite loops
  if (!user.full_name) {
    redirect("/setup");
  }

  if (brands.length === 0 && invites.length === 0) {
    redirect(getForceSignOutPath(INVITE_REQUIRED_LOGIN_PATH));
  }

  if (brands.length === 0 && invites.length > 0) {
    redirect("/invites");
  }

  // Access overlays are rendered inside the concrete content shells so sidebar
  // and editor chrome can stay accessible when needed.

  return (
    <div className="relative h-full min-h-0">
      {access.banner === "past_due" ? <PastDueBanner /> : null}
      {access.banner === "pending_cancellation" ? (
        <PendingCancellationBanner accessUntil={access.currentPeriodEnd} />
      ) : null}
      <div className="relative h-full min-h-0">{children}</div>
    </div>
  );
}
