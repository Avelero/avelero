import {
  BRAND_ACCESS_REMOVED_LOGIN_PATH,
  sanitizeAppPath,
} from "@/lib/auth-access";
import { createClient } from "@v1/supabase/server";
import { NextResponse } from "next/server";

async function handleForceSignOut(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = sanitizeAppPath(
    searchParams.get("next"),
    BRAND_ACCESS_REMOVED_LOGIN_PATH,
  );

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
