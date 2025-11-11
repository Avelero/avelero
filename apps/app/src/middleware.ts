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
  
  if (!pathnameHasLocale && !pathname.includes("/api/")) {
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

  // Not authenticated - redirect to login
  if (
    !session &&
    !pathname.includes("/login") &&
    !pathname.includes("/api/")
  ) {
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
  matcher: ["/((?!_next/static|_next/image|favicon/|favicon.ico|api).*)"],
};
