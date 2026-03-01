import crypto from "node:crypto";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHashParam = url.searchParams.get("token_hash");
  const rawToken = url.searchParams.get("token"); // backward compat if ever used

  const loginUrl = new URL("/login", url.origin);

  if (!tokenHashParam && !rawToken) {
    loginUrl.searchParams.set("invite", "invalid");
    return NextResponse.redirect(loginUrl);
  }

  const tokenHash = tokenHashParam
    ? tokenHashParam
    : crypto
        .createHash("sha256")
        .update(rawToken as string)
        .digest("hex");

  // Keep a URL fallback for OAuth flows where server-side callback might not
  // receive the invite cookie reliably after client-side token sign-in.
  loginUrl.searchParams.set("invite_token_hash", tokenHash);

  const res = NextResponse.redirect(loginUrl);
  res.cookies.set("brand_invite_token_hash", tokenHash, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV !== "development",
    maxAge: 30 * 60,
    path: "/",
  });
  return res;
}
