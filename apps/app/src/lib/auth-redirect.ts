import { getQueryClient, trpc } from "@/trpc/server";
import { createClient } from "@v1/supabase/server";

interface ResolveAuthRedirectOptions {
  next?: string | null;
  returnTo?: string | null;
}

/**
 * Resolves the appropriate redirect path after authentication based on user state.
 *
 * Uses tRPC for queries (cached and reused by layout) following Midday's server-side pattern.
 * Uses Supabase directly for the active brand mutation since app layer doesn't have DB access.
 *
 * @param options - Optional next/returnTo paths for post-auth navigation
 * @returns Redirect path based on user's profile and brand membership state
 */
export async function resolveAuthRedirectPath({
  next,
  returnTo,
}: ResolveAuthRedirectOptions = {}): Promise<string> {
  const queryClient = getQueryClient();

  // Fetch user profile and brand memberships via tRPC (single optimized query)
  // This data gets cached and reused by the dashboard layout, eliminating duplicate fetches
  const { user, brands } = await queryClient.fetchQuery(
    trpc.composite.workflowInit.queryOptions(),
  );

  if (!user) return "/login?error=auth-session-missing";

  // Check if user has completed profile setup
  const isProfileIncomplete =
    !user.full_name || user.full_name.trim().length < 2;
  if (isProfileIncomplete) return "/setup";

  const target = returnTo || next || "/";

  // No brand memberships -> redirect to create brand flow
  if (brands.length === 0) {
    return "/create-brand";
  }

  // If user has brands but no active brand selected, set the first one as active
  // This happens when user accepts an invite or joins their first brand
  if (brands.length > 0 && !user.brand_id && brands[0]) {
    const selectedBrandId = brands[0].id;
    try {
      // Update active brand via Supabase (app doesn't have direct DB access)
      // Security: User can only set brands they're a member of (verified by brands array from tRPC)
      const supabase = await createClient();
      await supabase
          .from("users")
          .update({ brand_id: selectedBrandId })
        .eq("id", user.id);
      } catch {
      // Best-effort operation - continue even if it fails
      // User can manually select brand from account settings
    }
  }

  return target.startsWith("/") ? target : `/${target}`;
}
