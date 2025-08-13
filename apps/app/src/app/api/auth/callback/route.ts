import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const returnTo = searchParams.get("return_to");

  const supabase = await createClient();

  // If we received an OAuth/PKCE code, exchange it. OTP flows won't include a code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
    }
  }

  // Claim any accepted invites for this user (best effort)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  if (user) {
    try {
      await supabase.rpc("claim_invites_for_user", { p_user_id: user.id });
      // Ensure active brand is set to the most recent membership
      const { data: recentMembership } = await supabase
        .from("users_on_brand")
        .select("brand_id, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const selectedBrandId = recentMembership?.brand_id ?? null;
      if (selectedBrandId) {
        await supabase.from("users").update({ brand_id: selectedBrandId }).eq("id", user.id);
      }
    } catch (e) {
      // ignore failures; redirect policy will still work
    }
  }

  // Determine redirect URL base on environment
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  let baseUrl: string;
  if (isLocalEnv) {
    baseUrl = origin;
  } else if (forwardedHost) {
    baseUrl = `https://${forwardedHost}`;
  } else {
    baseUrl = origin;
  }

  const redirectPath = await resolveAuthRedirectPath(supabase, {
    next,
    returnTo,
  });

  return NextResponse.redirect(`${baseUrl}${redirectPath}`, 303);
}
