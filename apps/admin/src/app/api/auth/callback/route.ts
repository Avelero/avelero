import { createClient } from "@v1/supabase/server";
import { ADMIN_LOGIN_ERROR_COOKIE } from "@/lib/login-error";
import { NextResponse } from "next/server";

function toLoginRedirect(origin: string, code: string) {
  const response = NextResponse.redirect(`${origin}/login`);
  response.cookies.set(ADMIN_LOGIN_ERROR_COOKIE, code, {
    maxAge: 60,
    path: "/login",
    sameSite: "lax",
  });
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return toLoginRedirect(origin, "auth-failed");
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    await supabase.auth.signOut({ scope: "global" });
    return toLoginRedirect(origin, "auth-failed");
  }

  const { data: isPlatformAdmin, error: adminCheckError } = await supabase.rpc(
    "is_platform_admin_actor",
  );

  if (adminCheckError || !isPlatformAdmin) {
    await supabase.auth.signOut({ scope: "global" });
    return toLoginRedirect(origin, "auth-denied");
  }

  return NextResponse.redirect(`${origin}/`, 303);
}
