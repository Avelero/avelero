import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const returnTo = searchParams.get("return_to");

  const supabase = createClient();

  // If we received an OAuth/PKCE code, exchange it. OTP flows won't include a code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
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
