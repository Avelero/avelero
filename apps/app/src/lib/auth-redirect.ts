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
  let { data: profile, error } = await supabase
    .from("users")
    .select("full_name, brand_id")
    .eq("id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116" && currentUser.email) {
      // If profile is missing (PGRST116 = no rows found), try to create it
      // This happens if the auth hook was disabled or failed
      const { data: newProfile, error: createError } = await supabase
        .from("users")
        .insert({
          id: userId,
          email: currentUser.email,
          full_name: currentUser.user_metadata?.full_name ?? null,
        })
        .select("full_name, brand_id")
        .single();

      if (createError) {
        return "/login?error=profile-creation-failed";
      }

      profile = newProfile;
    } else {
      // Handle other errors or missing email
      return "/login?error=profile-fetch-failed";
    }
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
    .from("brand_members")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  const target = returnTo || next || "/";

  // Invite-only routing for users without any memberships.
  const membershipCount = typeof count === "number" ? count : 0;
  if (membershipCount === 0) {
    const normalizedEmail = currentUser.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      return "/pending-access";
    }

    const nowIso = new Date().toISOString();
    const { count: inviteCount } = await supabase
      .from("brand_invites")
      .select("*", { count: "exact", head: true })
      .ilike("email", normalizedEmail)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);

    if ((inviteCount ?? 0) > 0) {
      return "/invites";
    }
    return "/pending-access";
  }

  // If user has memberships but no active brand selected, pick the most recent membership
  if (membershipCount > 0 && !typedProfile?.brand_id) {
    const { data: recentMembership } = await supabase
      .from("brand_members")
      .select("brand_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Type assertion for recentMembership
    const typedMembership = recentMembership as Pick<
      Tables<"brand_members">,
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
  // Only check at the start to allow absolute URLs in query parameters
  if (target.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(target)) {
    return "/";
  }

  // Normalize path: collapse any leading slashes to a single "/"
  if (target.startsWith("/")) {
    return `/${target.replace(/^\/+/, "")}`;
  }

  return `/${target}`;
}
