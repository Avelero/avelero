import {
  BRAND_ACCESS_REMOVED_LOGIN_PATH,
  FORCE_SIGN_OUT_ROUTE,
  sanitizeAppPath,
} from "@/lib/auth-access";
import { NextResponse } from "next/server";

async function handleForceSignOut(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeAppPath(
    searchParams.get("next"),
    BRAND_ACCESS_REMOVED_LOGIN_PATH,
  );

  const url = new URL(FORCE_SIGN_OUT_ROUTE, origin);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url, 307);
}

export async function GET(request: Request) {
  return handleForceSignOut(request);
}

export async function POST(request: Request) {
  return handleForceSignOut(request);
}
