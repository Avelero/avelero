import {
  BRAND_ACCESS_REMOVED_LOGIN_PATH,
  sanitizeAppPath,
} from "@/lib/auth-access";
import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";

function isPrefetchRequest(request: Request): boolean {
  const nextRouterPrefetch = request.headers.get("next-router-prefetch");
  const purpose = request.headers.get("purpose");
  const secPurpose = request.headers.get("sec-purpose");
  const secFetchMode = request.headers.get("sec-fetch-mode");
  const secFetchDest = request.headers.get("sec-fetch-dest");

  return (
    nextRouterPrefetch === "1" ||
    purpose?.toLowerCase().includes("prefetch") === true ||
    secPurpose?.toLowerCase().includes("prefetch") === true ||
    (secFetchMode?.toLowerCase() === "cors" &&
      secFetchDest?.toLowerCase() === "empty" &&
      request.headers.get("x-middleware-prefetch") === "1")
  );
}

async function handleForceSignOut(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeAppPath(
    searchParams.get("next"),
    BRAND_ACCESS_REMOVED_LOGIN_PATH,
  );

  // Ignore speculative prefetches; signout is a side effect.
  if (isPrefetchRequest(request)) {
    return new NextResponse(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const supabase = await createClient();

  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch {
    // Best effort: always continue to login destination.
  }

  return NextResponse.redirect(`${origin}${next}`, 303);
}

export async function GET(request: Request) {
  return handleForceSignOut(request);
}

export async function POST(request: Request) {
  return handleForceSignOut(request);
}
