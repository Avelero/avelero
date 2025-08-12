import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const rawToken = url.searchParams.get("token");
  const tokenHashParam = url.searchParams.get("token_hash");

  // Build redirect to login
  const loginUrl = new URL("/login", url.origin);

  if (!rawToken && !tokenHashParam) {
    loginUrl.searchParams.set("invite", "invalid");
    return NextResponse.redirect(loginUrl);
  }

  const tokenHash = tokenHashParam
    ? tokenHashParam
    : crypto.createHash("sha256").update(rawToken as string).digest("hex");

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY as string | undefined;
  if (!supabaseUrl || !serviceKey) {
    loginUrl.searchParams.set("invite", "server-misconfig");
    return NextResponse.redirect(loginUrl);
  }

  const admin = createSupabaseJsClient(supabaseUrl, serviceKey);

  // Lookup invite by token hash
  const { data: invite, error: inviteErr } = await admin
    .from("brand_invites")
    .select("id, status, expires_at")
    .eq("token_hash", tokenHash)
    .single();

  if (inviteErr || !invite) {
    loginUrl.searchParams.set("invite", "not-found");
    return NextResponse.redirect(loginUrl);
  }

  // Validate expiry/revocation
  const isExpired = invite.expires_at ? new Date(invite.expires_at) <= new Date() : false;
  if (invite.status === "revoked" || invite.status === "expired" || isExpired) {
    if (isExpired && invite.status !== "expired") {
      await admin.from("brand_invites").update({ status: "expired" }).eq("id", invite.id);
    }
    loginUrl.searchParams.set("invite", "expired");
    return NextResponse.redirect(loginUrl);
  }

  // Mark accepted (idempotent)
  await admin
    .from("brand_invites")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", invite.id);

  loginUrl.searchParams.set("invite", "accepted");
  return NextResponse.redirect(loginUrl);
}