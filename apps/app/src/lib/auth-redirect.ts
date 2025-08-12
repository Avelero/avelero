import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

interface ResolveAuthRedirectOptions {
  next?: string | null;
  returnTo?: string | null;
}

export async function resolveAuthRedirectPath(
  supabase: SupabaseClient<Database>,
  { next, returnTo }: ResolveAuthRedirectOptions = {},
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return "/login?error=auth-session-missing";

  const userId = user.id;

  // Profile completeness check
  const { data: profile } = await supabase
    .from("users")
    .select("full_name, brand_id")
    .eq("id", userId)
    .single();
  const isProfileIncomplete = !profile?.full_name || profile.full_name.trim().length < 2;
  if (isProfileIncomplete) return "/setup";

  const { count } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  const target = returnTo || next || "/";

  // No brand memberships and not an invite link -> create brand
  const membershipCount = typeof count === "number" ? count : 0;
  if (membershipCount === 0 && !returnTo?.startsWith("brands/invite/")) {
    return "/brands/create";
  }

  // If user has memberships but no active brand selected, pick the most recent membership
  if (membershipCount > 0 && !profile?.brand_id) {
    const { data: recentMembership } = await supabase
      .from("users_on_brand")
      .select("brand_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const selectedBrandId = recentMembership?.brand_id ?? null;
    if (selectedBrandId) {
      // Best-effort: set active brand to most recent
      await supabase
        .from("users")
        .update({ brand_id: selectedBrandId })
        .eq("id", userId);
    }
  }

  return target.startsWith("/") ? target : `/${target}`;
}

