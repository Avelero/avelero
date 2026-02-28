import { isAdminEmailAllowed } from "@/lib/admin-allowlist";
import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";

function toLoginRedirect(origin: string, code: string) {
  return NextResponse.redirect(`${origin}/login?error=${code}`);
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

  if (!isAdminEmailAllowed(user.email)) {
    await supabase.auth.signOut({ scope: "global" });
    return toLoginRedirect(origin, "auth-denied");
  }

  return NextResponse.redirect(`${origin}/`, 303);
}
