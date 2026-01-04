import { resolveAuthRedirectPath } from "@/lib/auth-redirect";
import { createClient } from "@v1/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const returnTo = searchParams.get("return_to");

  // Preview OAuth workaround: If this request came from a preview environment,
  // we need to redirect back to that preview URL after auth
  const previewReturnUrl = searchParams.get("preview_return_url");

  const supabase = await createClient();

  // If we received an OAuth/PKCE code, exchange it. OTP flows won't include a code.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // If this was a preview redirect, send error back to preview
      if (previewReturnUrl) {
        const decodedUrl = decodeURIComponent(previewReturnUrl);
        const previewUrl = new URL(decodedUrl);
        previewUrl.searchParams.set("error", "auth-code-error");
        return NextResponse.redirect(previewUrl.toString(), 303);
      }
      return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
    }
  }

  // Post-auth invite redemption via cookie (best effort)
  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;
  const cookieStore = await cookies();
  const cookieHash = cookieStore.get("brand_invite_token_hash")?.value ?? null;
  let acceptedBrand = false;
  if (user && cookieHash) {
    try {
      // Use SECURITY DEFINER RPC to accept invite atomically
      const { error: rpcError } = await supabase.rpc(
        "accept_invite_from_cookie",
        { p_token: cookieHash },
      );
      if (!rpcError) acceptedBrand = true;
    } catch {
      // ignore failures
    }
  }

  // Handle preview OAuth redirect
  // The preview deployment sent the user through production for OAuth.
  // Now we redirect them back to their preview URL.
  if (previewReturnUrl) {
    const decodedUrl = decodeURIComponent(previewReturnUrl);
    // Parse the preview URL and add auth callback path
    const previewUrl = new URL(decodedUrl);
    // Redirect to the preview's auth callback which will pick up the session
    const previewCallback = new URL("/api/auth/callback", previewUrl.origin);
    previewCallback.searchParams.set("from_production", "true");
    if (returnTo) {
      previewCallback.searchParams.set("return_to", returnTo);
    }

    const response = NextResponse.redirect(previewCallback.toString(), 303);
    // Clear invite cookie if it was used
    if (cookieHash) {
      response.cookies.set("brand_invite_token_hash", "", {
        maxAge: 0,
        path: "/",
      });
    }
    return response;
  }

  // Standard flow for production/local
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
  if (cookieHash) {
    response.cookies.set("brand_invite_token_hash", "", {
      maxAge: 0,
      path: "/",
    });
  }
  return response;
}

