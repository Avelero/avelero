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
        normalized.includes("account_not_found") ||
        normalized.includes("user not found") ||
        normalized.includes("signups not allowed") ||
        normalized.includes("signup is disabled");
      const mappedError =
        isInviteRequired ? "invite-required" : "auth-code-error";
      return NextResponse.redirect(`${origin}/login?error=${mappedError}`);
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
  const acceptedBrand = inviteRedemption.accepted;

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

  const redirectPath = acceptedBrand
    ? "/"
    : await resolveAuthRedirectPath({
        next,
        returnTo,
        client: supabase,
        user,
      });

  // Build response and clear the invite cookie if present
  const response = NextResponse.redirect(`${baseUrl}${redirectPath}`, 303);
  if (inviteTokenHash && inviteRedemption.shouldClearCookie) {
    response.cookies.set(INVITE_COOKIE_NAME, "", {
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}
