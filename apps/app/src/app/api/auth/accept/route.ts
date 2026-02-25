import {
  getInviteErrorRedirectPath,
  redeemInviteTokenHash,
  resolveInviteTokenHash,
} from "@/lib/auth/invite-redemption";
import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHashParam = url.searchParams.get("token_hash");
  const rawToken = url.searchParams.get("token"); // backward compat if ever used

  const loginUrl = new URL("/login", url.origin);

  const tokenHash = resolveInviteTokenHash(tokenHashParam, rawToken);
  if (!tokenHash) {
    const errorPath = getInviteErrorRedirectPath("invalid_token");
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const redemption = await redeemInviteTokenHash(supabase, tokenHash);
    if (redemption.ok) {
      return NextResponse.redirect(new URL("/", url.origin));
    }

    const errorPath = getInviteErrorRedirectPath(redemption.errorCode);
    return NextResponse.redirect(new URL(errorPath, url.origin));
  }

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set("brand_invite_token_hash", tokenHash, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    maxAge: 30 * 60,
    path: "/",
  });
  return response;
}
