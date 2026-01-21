import { type CookieOptions, createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Header name for passing the auth token from proxy to server components.
 * This avoids the cookie timing issue where refreshed tokens aren't
 * immediately available to server components via cookies().
 */
export const AUTH_TOKEN_HEADER = "x-supabase-auth";

/**
 * Updates the Supabase session in the proxy (middleware).
 *
 * Creates a Supabase client that can write cookies to the response,
 * then calls getUser() to trigger token refresh if needed. This ensures
 * refreshed tokens are saved to cookies for subsequent requests.
 *
 * Also sets the access token on a REQUEST header so server components
 * can access the (potentially refreshed) token immediately via headers().
 *
 * @returns The response with updated cookies, request headers, and the authenticated Supabase client
 */
export async function updateSession(
  request: NextRequest,
): Promise<{ response: NextResponse; supabase: SupabaseClient }> {
  // Clone request headers so we can add our auth token header
  const requestHeaders = new Headers(request.headers);

  // Create an intermediate response to collect cookies from Supabase
  const cookieResponse = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          cookieResponse.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          cookieResponse.cookies.set({ name, value: "", ...options });
        },
      },
    },
  );

  // Call getUser() to trigger token refresh if needed.
  // This validates the session and refreshes the access token if expired.
  // Refreshed tokens are saved to cookies via the set() callback above.
  await supabase.auth.getUser();

  // Get the session (which now has the refreshed token if refresh occurred)
  // and set it on a REQUEST header for server components to use.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (session?.access_token) {
    requestHeaders.set(AUTH_TOKEN_HEADER, session.access_token);
  }

  // Create the final response with modified request headers
  // This makes the auth token available to server components via headers()
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Copy cookies from the intermediate response to the final response
  for (const cookie of cookieResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  return { response, supabase };
}
