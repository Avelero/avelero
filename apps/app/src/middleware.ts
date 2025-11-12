import { updateSession } from "@v1/supabase/middleware";
import { createClient } from "@v1/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

const DEFAULT_LOCALE = "en";

export async function middleware(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const pathname = nextUrl.pathname;

  // If pathname doesn't start with a locale, rewrite it to include default locale
  // This allows URLs like /settings to work with [locale] folder structure
  const pathnameHasLocale = pathname.startsWith(`/${DEFAULT_LOCALE}/`);

  let response: NextResponse;

  // Check if pathname is an API route: /api or /api/...
  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");

  if (!pathnameHasLocale && !isApiRoute) {
    // Rewrite to include default locale in the path
    const url = new URL(`/${DEFAULT_LOCALE}${pathname}`, request.url);
    url.search = nextUrl.search;
    response = NextResponse.rewrite(url);
  } else {
    response = NextResponse.next();
  }

  // Update Supabase session
  response = await updateSession(request, response);

  // Set pathname in headers for server components
  response.headers.set("x-pathname", pathname);

  const supabase = await createClient();
  const encodedSearchParams = `${pathname.substring(1)}${nextUrl.search}`;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Check if pathname is login route: /login or /login/...
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  // Not authenticated - redirect to login
  if (!session && !isLoginRoute && !isApiRoute) {
    const url = new URL("/login", request.url);
    if (encodedSearchParams) {
      url.searchParams.append("return_to", encodedSearchParams);
    }
    return NextResponse.redirect(url);
  }

  // If all checks pass, return the response
  return response;
}

export const config = {
  // Exclude: _next/static, _next/image, favicon/, favicon.ico, static files with extensions, and /api routes
  // Note: \.[a-z0-9]+$ matches file extensions at the end of the path only
  matcher: [
    "/((?!_next/static|_next/image|favicon/|favicon.ico|api/|.*\\.[a-z0-9]+$).*)",
  ],
};
