import { updateSession } from "@v1/supabase/proxy";
import { createClient } from "@v1/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const pathname = nextUrl.pathname;

  // Check if pathname is an API route: /api or /api/...
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

  const response = NextResponse.next();

  // Update Supabase session
  const updatedResponse = await updateSession(request, response);

  // Set pathname in headers for server components
  updatedResponse.headers.set("x-pathname", pathname);

  const supabase = await createClient();
  const encodedSearchParams = `${pathname.substring(1)}${nextUrl.search}`;

  // Use getUser() to validate the token with Supabase auth server
  // Note: getSession() only reads cookies without validation - don't use for security-critical paths
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
