import {
  getInviteErrorRedirectPath,
  redeemInviteTokenHash,
} from "@/lib/auth/invite-redemption";
import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@v1/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function mapAuthCodeErrorToPath(message: string | undefined): string {
  const normalizedMessage = (message ?? "").toLowerCase();
  const isAccountNotFound =
    normalizedMessage.includes("account_not_found") ||
    normalizedMessage.includes("invite_required") ||
    normalizedMessage.includes("user not found") ||
    normalizedMessage.includes("signups not allowed") ||
    normalizedMessage.includes("signup is disabled");

  const code = isAccountNotFound ? "account_not_found" : "auth-code-error";
  return `/login?error=${encodeURIComponent(code)}`;
}

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
      return NextResponse.redirect(
        `${origin}${mapAuthCodeErrorToPath(error.message)}`,
      );
    }
  }

  // Post-auth invite redemption via cookie.
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  const cookieStore = await cookies();
  const cookieHash = cookieStore.get("brand_invite_token_hash")?.value ?? null;
  let acceptedBrand = false;
  let inviteErrorPath: string | null = null;

  if (user && cookieHash) {
    const redemption = await redeemInviteTokenHash(supabase, cookieHash);
    if (redemption.ok) {
      acceptedBrand = true;
    } else {
      inviteErrorPath = getInviteErrorRedirectPath(redemption.errorCode);
    }
  }

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

  const redirectPath =
    inviteErrorPath ??
    (acceptedBrand
      ? "/"
      : await resolveAuthRedirectPath({
          next,
          returnTo,
          client: supabase,
          user,
        }));

  // Build response and clear the invite cookie if present
  const response = NextResponse.redirect(`${baseUrl}${redirectPath}`, 303);
  if (cookieHash) {
    response.cookies.set("brand_invite_token_hash", "", {
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}
