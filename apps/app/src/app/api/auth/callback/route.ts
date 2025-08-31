import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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

  // Post-auth invite redemption via cookie (best effort)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  const cookieStore = await cookies();
  const cookieHash = cookieStore.get("brand_invite_token_hash")?.value ?? null;
  let acceptedBrand: boolean = false;
  if (user && cookieHash) {
    try {
      // Use SECURITY DEFINER RPC to accept invite atomically
      const { error: rpcError } = await supabase.rpc("accept_invite_from_cookie", { p_token: cookieHash });
      if (!rpcError) acceptedBrand = true;
    } catch {
      // ignore failures
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

  const redirectPath = acceptedBrand ? "/" : await resolveAuthRedirectPath(supabase, {
    next,
    returnTo,
  });

  // Build response and clear the invite cookie if present
  const response = NextResponse.redirect(`${baseUrl}${redirectPath}`, 303);
  if (cookieHash) {
    response.cookies.set("brand_invite_token_hash", "", { maxAge: 0, path: "/" });
  }
  return response;
}
