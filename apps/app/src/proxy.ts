import { updateSession } from "@v1/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const pathname = nextUrl.pathname;

  // Check if pathname is an API route: /api or /api/...
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

  // Update Supabase session and get the authenticated client.
  // updateSession creates a response with request headers containing the auth token,
  // making it available to server components via headers().
  const { response: updatedResponse, supabase } = await updateSession(request);

  // Get the user from the already-validated session (no extra API call needed)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const encodedSearchParams = `${pathname.substring(1)}${nextUrl.search}`;

  // Check if pathname is login route: /login or /login/...
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  // Not authenticated - redirect to login
  if (!user && !isLoginRoute && !isApiRoute) {
    const url = new URL("/login", request.url);
    if (encodedSearchParams) {
      url.searchParams.append("return_to", encodedSearchParams);
    }
    return NextResponse.redirect(url);
  }

  // Temporary: root app route maps to Passports while Dashboard is unused.
  if (user && pathname === "/") {
    const url = new URL("/passports", request.url);
    url.search = nextUrl.search;

    const redirectResponse = NextResponse.redirect(url);
    for (const cookie of updatedResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }
    return redirectResponse;
  }

  // If all checks pass, return the response
  return updatedResponse;
}

export const config = {
  // Exclude: _next/static, _next/image, favicon/, favicon.ico, static files with extensions, and /api routes
  // Note: \.[a-z0-9]+$ matches file extensions at the end of the path only
  matcher: [
    "/((?!_next/static|_next/image|favicon/|favicon.ico|api/|.*\\.[a-z0-9]+$).*)",
  ],
};
