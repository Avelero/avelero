import { updateSession } from "@v1/supabase/middleware";
import { createClient } from "@v1/supabase/server";
import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  const response = await updateSession(request, NextResponse.next());
  const supabase = await createClient();
  const pathname = request.nextUrl.pathname;

  // Set pathname in headers for server components
  response.headers.set("x-pathname", pathname);

  const encodedSearchParams = `${pathname.substring(1)}${request.nextUrl.search}`;

  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Not authenticated - redirect to login
  if (
    !session &&
    pathname !== "/login" &&
    !pathname.includes("/api/")
  ) {
    const url = new URL("/login", request.url);
    if (encodedSearchParams) {
      url.searchParams.append("return_to", encodedSearchParams);
    }
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon/|favicon.ico|api).*)"],
};
