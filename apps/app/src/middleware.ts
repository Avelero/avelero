import { updateSession } from "@v1/supabase/middleware";
import { createClient } from "@v1/supabase/server";
import { createI18nMiddleware } from "next-international/middleware";
import { type NextRequest, NextResponse } from "next/server";

const LOCALES = ["en", "fr"]; // used to validate the first path segment

const I18nMiddleware = createI18nMiddleware({
  locales: LOCALES,
  defaultLocale: "en",
  urlMappingStrategy: "rewrite",
});

export async function middleware(request: NextRequest) {
  const i18nResponse = I18nMiddleware(request);
  const response = await updateSession(request, i18nResponse);
  const supabase = await createClient();
  const url = new URL("/", request.url);
  const nextUrl = request.nextUrl;

  // Set pathname in headers for server components
  response.headers.set("x-pathname", nextUrl.pathname);

  const seg1 = nextUrl.pathname.split("/", 2)?.[1] ?? "";
  const isLocale = LOCALES.includes(seg1);

  // Remove the locale only if it is a real locale
  const pathnameWithoutLocale = isLocale
    ? nextUrl.pathname.slice(seg1.length + 1)
    : nextUrl.pathname;

  // Create a new URL without the locale in the pathname
  const newUrl = new URL(pathnameWithoutLocale || "/", request.url);

  const encodedSearchParams = `${newUrl.pathname.substring(1)}${newUrl.search}`;

  // Add redirect for old /brands/create path
  if (newUrl.pathname === "/brands/create") {
    const redirectUrl = new URL(`/${seg1}/create-brand`, request.url);
    return NextResponse.redirect(redirectUrl, 308);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not authenticated - redirect to login
  if (
    !session &&
    newUrl.pathname !== "/login" &&
    !newUrl.pathname.includes("/api/")
  ) {
    const url = new URL("/login", request.url);
    if (encodedSearchParams) {
      url.searchParams.append("return_to", encodedSearchParams);
    }
    return NextResponse.redirect(url);
  }

  // If all checks pass, return the original or updated response
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon/|favicon.ico|api).*)"],
};
