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

  const { count } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact" })
    .eq("user_id", userId);

  const target = returnTo || next || "/";

  // New user flow - no brand memberships and not an invite link
  if (count === 0 && !returnTo?.startsWith("brands/invite/")) {
    return "/setup";
  }

  return target.startsWith("/") ? target : `/${target}`;
}

