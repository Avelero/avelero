import { isAdminEmailAllowed } from "@/lib/admin-allowlist";
import { updateSession } from "@v1/supabase/proxy";
import { type NextRequest, NextResponse } from "next/server";

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (!cookie.name.startsWith("sb-")) continue;
    response.cookies.set(cookie.name, "", {
      maxAge: 0,
      path: "/",
    });
  }
}

export async function proxy(request: NextRequest) {
  const nextUrl = request.nextUrl;
  const pathname = nextUrl.pathname;

  const isApiRoute = pathname === "/api" || pathname.startsWith("/api/");
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");

  const { response: updatedResponse, supabase } = await updateSession(request);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLoginRoute && !isApiRoute) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (user && !isAdminEmailAllowed(user.email)) {
    await supabase.auth.signOut({ scope: "global" });

    const url = new URL("/login", request.url);
    url.searchParams.set("error", "auth-denied");

    const redirectResponse = NextResponse.redirect(url);
    clearSupabaseCookies(request, redirectResponse);

    return redirectResponse;
  }

  if (user && isLoginRoute) {
    const url = new URL("/", request.url);
    const redirectResponse = NextResponse.redirect(url);

    for (const cookie of updatedResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie);
    }

    return redirectResponse;
  }

  return updatedResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon/|favicon.ico|api/|.*\\.[a-z0-9]+$).*)",
  ],
};
