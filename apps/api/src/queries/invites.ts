import crypto from "node:crypto";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { tasks } from "@trigger.dev/sdk/v3";
import type { Database } from "@v1/supabase/types";
import { getAppUrl } from "@v1/utils/envs";
import { assertOwner } from "./brand-members.js";

interface ErrorResult {
  ok: false;
  code: string;
  message: string;
}

interface AcceptSuccessResult {
  ok: true;
  brandId: string;
}

interface RejectSuccessResult {
  ok: true;
}

interface InviteRow {
  id: string;
  brand_id: string;
  email: string;
  role: "owner" | "member";
  expires_at: string | null;
  token_hash: string | null;
}

function isInviteExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Number.isFinite(exp) && exp <= now;
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export async function getInviteForRecipientById(
  supabase: SupabaseClient<Database>,
  user: User,
  inviteId: string,
): Promise<InviteRow | null> {
  const { data, error } = await supabase
    .from("brand_invites")
    .select("id, brand_id, email, role, expires_at, token_hash")
    .eq("id", inviteId)
    .maybeSingle();
  if (error || !data) return null;
  const userEmail = normalizeEmail(user.email);
  if (normalizeEmail(data.email) !== userEmail) return null;
  return data as unknown as InviteRow;
}

export async function getInviteForRecipientByTokenHash(
  supabase: SupabaseClient<Database>,
  user: User,
  tokenHash: string,
): Promise<InviteRow | null> {
  const { data, error } = await supabase
    .from("brand_invites")
    .select("id, brand_id, email, role, expires_at, token_hash")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error || !data) return null;
  const userEmail = normalizeEmail(user.email);
  if (normalizeEmail(data.email) !== userEmail) return null;
  return data as unknown as InviteRow;
}

export async function acceptInviteForRecipientById(
  supabase: SupabaseClient<Database>,
  user: User,
  inviteId: string,
): Promise<AcceptSuccessResult | ErrorResult> {
  const invite = await getInviteForRecipientById(supabase, user, inviteId);
  if (!invite)
    return { ok: false, code: "NOT_FOUND", message: "Invite not found" };
  if (isInviteExpired(invite.expires_at))
    return { ok: false, code: "EXPIRED", message: "Invite expired" };
  // Reuse the SECURITY DEFINER RPC by passing the stored token_hash.
  if (!invite.token_hash) {
    return {
      ok: false,
      code: "MISSING_TOKEN_HASH",
      message: "Invite missing token hash",
    };
  }
  const { error: rpcError } = await supabase.rpc("accept_invite_from_cookie", {
    p_token: invite.token_hash,
  });
  if (rpcError)
    return { ok: false, code: "RPC_ACCEPT_FAILED", message: rpcError.message };
  return { ok: true, brandId: invite.brand_id };
}

export async function acceptInviteForRecipientByTokenHash(
  supabase: SupabaseClient<Database>,
  user: User,
  tokenHash: string,
): Promise<AcceptSuccessResult | ErrorResult> {
  // With SECURITY DEFINER RPC now available, prefer it for token-accept flows.
  const { error: rpcError } = await supabase.rpc("accept_invite_from_cookie", {
    p_token: tokenHash,
  });
  if (rpcError)
    return { ok: false, code: "RPC_ACCEPT_FAILED", message: rpcError.message };
  // The RPC sets active brand and deletes the invite. We can fetch the active brand if needed.
  // For API shape consistency, return a generic success; callers typically redirect to '/'.
  return { ok: true, brandId: "" };
}

export async function rejectInviteForRecipientById(
  supabase: SupabaseClient<Database>,
  user: User,
  inviteId: string,
): Promise<RejectSuccessResult | ErrorResult> {
  const invite = await getInviteForRecipientById(supabase, user, inviteId);
  if (!invite)
    return { ok: false, code: "NOT_FOUND", message: "Invite not found" };

  const { error: deleteErr } = await supabase
    .from("brand_invites")
    .delete()
    .eq("id", invite.id);
  if (deleteErr)
    return {
      ok: false,
      code: "INVITE_DELETE_FAILED",
      message: deleteErr.message,
    };

  return { ok: true };
}

// ---------------------- Owner-driven invite actions ----------------------

export async function sendBrandInvite(
  supabase: SupabaseClient<Database>,
  admin: SupabaseClient<Database> | null,
  params: {
    brand_id: string;
    email: string;
    role: "owner" | "member";
    created_by: string;
  },
) {
  // Ensure inviter is owner of the brand
  await assertOwner(supabase, params.created_by, params.brand_id);

  const appUrl = getAppUrl();

  // check if user exists
  async function isExistingUserByEmail(email: string) {
    if (admin) {
      const { data: existing } = await admin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing?.id) return true;
    }
    const { data } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return !!data?.id;
  }

  const exists = await isExistingUserByEmail(params.email);
  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  let tokenHash: string | null = null;
  let acceptUrl: string;

  if (exists) {
    // Existing user: generate token hash too (used by dashboard RPC), but keep dashboard link
    const raw = crypto.randomBytes(32).toString("hex");
    tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    acceptUrl = `${appUrl}/account/brands?tab=invites`;

    const { error: insertErr } = await supabase.from("brand_invites").insert({
      brand_id: params.brand_id,
      email: params.email,
      role: params.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: params.created_by,
    });
    if (insertErr) throw insertErr;
  } else {
    const raw = crypto.randomBytes(32).toString("hex");
    tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
    acceptUrl = `${appUrl}/api/auth/accept?token_hash=${tokenHash}`;

    const { error: insertErr } = await supabase.from("brand_invites").insert({
      brand_id: params.brand_id,
      email: params.email,
      role: params.role,
      token_hash: tokenHash,
      expires_at: expiresAt,
      created_by: params.created_by,
    });
    if (insertErr) throw insertErr;
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("name")
    .eq("id", params.brand_id)
    .single();

  await tasks.trigger("invite-brand-members", {
    invites: [
      {
        recipientEmail: params.email,
        brandName: brandRow?.name ?? "Avelero",
        role: params.role,
        acceptUrl,
        expiresAt,
        appName: "Avelero",
      },
    ],
  });

  return { success: true as const };
}

export async function revokeBrandInviteByOwner(
  supabase: SupabaseClient<Database>,
  userId: string,
  inviteId: string,
) {
  const { data: invite, error: invErr } = await supabase
    .from("brand_invites")
    .select("id, brand_id")
    .eq("id", inviteId)
    .single();
  if (invErr) throw invErr;
  if (!invite) throw new Error("NOT_FOUND");

  await assertOwner(supabase, userId, invite.brand_id);

  const { error: delErr } = await supabase
    .from("brand_invites")
    .delete()
    .eq("id", inviteId);
  if (delErr) throw delErr;
  return { success: true as const };
}

export async function listBrandInvites(
  supabase: SupabaseClient<Database>,
  userId: string,
  brandId: string,
) {
  // ensure membership (owner or member)
  const { count, error: countErr } = await supabase
    .from("users_on_brand")
    .select("*", { count: "exact", head: true })
    .eq("brand_id", brandId)
    .eq("user_id", userId);
  if (countErr) throw countErr;
  if (!count) throw new Error("FORBIDDEN");

  const { data, error } = await supabase
    .from("brand_invites")
    .select("id, email, role, expires_at, created_at")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return { data } as const;
}

export async function listInvitesByEmail(
  supabase: SupabaseClient<Database>,
  email: string,
) {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("brand_invites")
    .select(
      "id, email, role, expires_at, brands:brands(id, name, logo_path, avatar_hue)",
    )
    .eq("email", email)
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  type InviteWithBrandRow = {
    id: string;
    email: string;
    role: string;
    expires_at: string | null;
    brands: {
      id: string | null;
      name: string | null;
      logo_path: string | null;
      avatar_hue: number | null;
    } | null;
  };
  const rows = ((data ?? []) as InviteWithBrandRow[]).map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    expires_at: r.expires_at ?? null,
    brand: {
      id: r.brands?.id ?? null,
      name: r.brands?.name ?? null,
      logo_path: r.brands?.logo_path ?? null,
      avatar_hue: r.brands?.avatar_hue ?? null,
    },
  }));
  return { data: rows } as const;
}
