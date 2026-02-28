import { ADMIN_LOGIN_ERROR_COOKIE } from "@/lib/login-error";
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

  if (isLoginRoute && request.cookies.has(ADMIN_LOGIN_ERROR_COOKIE)) {
    updatedResponse.cookies.set(ADMIN_LOGIN_ERROR_COOKIE, "", {
      maxAge: 0,
      path: "/login",
      sameSite: "lax",
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isLoginRoute && !isApiRoute) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  if (user) {
    const { data: isPlatformAdmin, error } = await supabase.rpc(
      "is_platform_admin_actor",
    );

    if (!error && isPlatformAdmin) {
      if (isLoginRoute) {
        const url = new URL("/", request.url);
        const redirectResponse = NextResponse.redirect(url);

        for (const cookie of updatedResponse.cookies.getAll()) {
          redirectResponse.cookies.set(cookie);
        }

        return redirectResponse;
      }

      return updatedResponse;
    }

    await supabase.auth.signOut({ scope: "global" });

    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    redirectResponse.cookies.set(ADMIN_LOGIN_ERROR_COOKIE, "auth-denied", {
      maxAge: 60,
      path: "/login",
      sameSite: "lax",
    });
    clearSupabaseCookies(request, redirectResponse);

    return redirectResponse;
  }

  return updatedResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon/|favicon.ico|api/|.*\\.[a-z0-9]+$).*)",
  ],
};
