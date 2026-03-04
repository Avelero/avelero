import {
  BRAND_ACCESS_REMOVED_LOGIN_PATH,
  getForceSignOutPath,
  isInviteRequiredPath,
} from "@/lib/auth-access";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
import {
  INVITE_COOKIE_NAME,
  redeemInviteFromCookie,
} from "@/lib/invite-redemption";
import { createClient } from "@v1/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const returnTo = searchParams.get("return_to");
  const inviteTokenFromUrl = searchParams.get("invite_token_hash");
  const provider = searchParams.get("provider");

  const supabase = await createClient();

  // If we received an OAuth/PKCE code, exchange it. OTP flows won't include a code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const rawMessage = error.message ?? "";
      const normalized = rawMessage.toLowerCase();
      const isInviteRequired =
        normalized.includes("invite_required") ||
        normalized.includes("invite required") ||
        normalized.includes("auth_gate_denied") ||
        normalized.includes("auth gate denied") ||
        normalized.includes("account_not_found") ||
        normalized.includes("user not found") ||
        normalized.includes("signups not allowed") ||
        normalized.includes("signup is disabled");
      const mappedError =
        isInviteRequired ? "invite-required" : "auth-code-error";
      const loginUrl = new URL("/login", origin);
      loginUrl.searchParams.set("error", mappedError);
      if (provider === "google") {
        loginUrl.searchParams.set("provider", "google");
      }
      return NextResponse.redirect(loginUrl.toString());
    }
  }

  // Post-auth invite redemption via cookie (best effort)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  const cookieStore = await cookies();
  const cookieHash = cookieStore.get(INVITE_COOKIE_NAME)?.value ?? null;
  const inviteTokenHash = cookieHash ?? inviteTokenFromUrl ?? null;

  const inviteRedemption = await redeemInviteFromCookie({
    cookieHash: inviteTokenHash,
    user,
    client: supabase,
  });

  // Determine redirect URL based on environment
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

  const redirectPath = await resolveAuthRedirectPath({
    next,
    returnTo,
    client: supabase,
    user,
  });
  const noAccessPath =
    provider === "google"
      ? `${BRAND_ACCESS_REMOVED_LOGIN_PATH}&provider=google`
      : BRAND_ACCESS_REMOVED_LOGIN_PATH;
  const finalPath = isInviteRequiredPath(redirectPath)
    ? getForceSignOutPath(noAccessPath)
    : redirectPath;

  // Build response and clear the invite cookie if present
  const response = NextResponse.redirect(`${baseUrl}${finalPath}`, 303);
  if (inviteTokenHash && inviteRedemption.shouldClearCookie) {
    response.cookies.set(INVITE_COOKIE_NAME, "", {
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}
