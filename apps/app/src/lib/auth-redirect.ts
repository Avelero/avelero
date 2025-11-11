import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@v1/supabase/server";
import type { Tables, TablesUpdate } from "@v1/supabase/types";
import type { Database } from "@v1/supabase/types";

interface ResolveAuthRedirectOptions {
  next?: string | null;
  returnTo?: string | null;
  client?: SupabaseClient<Database>;
  user?: User | null;
}

export async function resolveAuthRedirectPath({
  next,
  returnTo,
  client,
  user,
}: ResolveAuthRedirectOptions = {}): Promise<string> {
  const supabase = client ?? (await createClient());

  let currentUser = user ?? null;
  if (currentUser === null && user === undefined) {
    const { data: userResult } = await supabase.auth.getUser();
    currentUser = userResult.user ?? null;
  }

  if (!currentUser) return "/login?error=auth-session-missing";

  const userId = currentUser.id;

  // Profile completeness check
  const { data: profile, error } = await supabase
    .from("users")
    .select("full_name, brand_id")
    .eq("id", userId)
    .single();

  if (error) {
    // Handle error appropriately
    return "/login?error=profile-fetch-failed";
  }

  // Type assertion to match working pattern in getUserProfile
  const typedProfile = profile as Pick<
    Tables<"users">,
    "full_name" | "brand_id"
  > | null;
  const isProfileIncomplete =
    !typedProfile?.full_name || typedProfile.full_name.trim().length < 2;
  if (isProfileIncomplete) return "/setup";

  const { count } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  const target = returnTo || next || "/";

  // No brand memberships and not an invite link -> create brand
  const membershipCount = typeof count === "number" ? count : 0;
  if (membershipCount === 0 && !returnTo?.startsWith("brands/invite/")) {
    return "/create-brand";
  }

  // If user has memberships but no active brand selected, pick the most recent membership
  if (membershipCount > 0 && !typedProfile?.brand_id) {
    const { data: recentMembership } = await supabase
      .from("users_on_brand")
      .select("brand_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Type assertion for recentMembership
    const typedMembership = recentMembership as Pick<
      Tables<"users_on_brand">,
      "brand_id"
    > | null;
    const selectedBrandId = typedMembership?.brand_id ?? null;
    if (selectedBrandId) {
      // Best-effort: set active brand to most recent using working mutation pattern
      try {
        // Type cast through unknown to bypass TypeScript inference issues
        await (supabase as unknown as SupabaseClient<Database>)
          .from("users")
          .update({ brand_id: selectedBrandId })
          .eq("id", userId);
      } catch {
        // Ignore update errors in this best-effort operation
      }
    }
  }

  // Validate redirect target: reject protocol-relative URLs and absolute URLs
  if (target.startsWith("//") || target.includes("://")) {
    return "/";
  }
  
  // Normalize path: collapse any leading slashes to a single "/"
  if (target.startsWith("/")) {
    return `/${target.replace(/^\/+/, "")}`;
  }
  
  return `/${target}`;
}
