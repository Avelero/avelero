import crypto from "node:crypto";
import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

const TOKEN_HASH_REGEX = /^[0-9a-f]{64}$/i;

type AcceptInviteRpcRow = {
  status: "accepted" | "error";
  brand_id: string | null;
  error_code: "expired_or_revoked" | "wrong_email" | "accept_failed" | null;
};

export type InviteErrorCode =
  | "invalid_token"
  | "expired_or_revoked"
  | "wrong_email"
  | "accept_failed";

export type InviteRedemptionResult =
  | { ok: true; brandId: string | null }
  | { ok: false; errorCode: InviteErrorCode };

function getInviteErrorCodeFromPostgrest(error: PostgrestError): InviteErrorCode {
  const message = error.message.toLowerCase();
  if (
    message.includes("invite not found") ||
    message.includes("expired") ||
    message.includes("not found")
  ) {
    return "expired_or_revoked";
  }
  if (message.includes("does not belong")) {
    return "wrong_email";
  }
  return "accept_failed";
}

function isAcceptInviteRpcRow(value: unknown): value is AcceptInviteRpcRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const status = row.status;
  const brandId = row.brand_id;
  const errorCode = row.error_code;
  const statusValid = status === "accepted" || status === "error";
  const brandIdValid = typeof brandId === "string" || brandId === null;
  const errorCodeValid =
    errorCode === "expired_or_revoked" ||
    errorCode === "wrong_email" ||
    errorCode === "accept_failed" ||
    errorCode === null;
  return statusValid && brandIdValid && errorCodeValid;
}

function parseAcceptInviteRpcData(data: unknown): AcceptInviteRpcRow | null {
  if (data == null) return null;
  if (Array.isArray(data)) {
    const firstRow = data[0];
    return isAcceptInviteRpcRow(firstRow) ? firstRow : null;
  }
  return isAcceptInviteRpcRow(data) ? data : null;
}

export function getInviteErrorRedirectPath(errorCode: InviteErrorCode): string {
  return `/login?invite_error=${encodeURIComponent(errorCode)}`;
}

export function resolveInviteTokenHash(
  tokenHashParam: string | null,
  rawToken: string | null,
): string | null {
  if (tokenHashParam) {
    const normalized = tokenHashParam.trim().toLowerCase();
    return TOKEN_HASH_REGEX.test(normalized) ? normalized : null;
  }

  if (!rawToken) return null;
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export async function redeemInviteTokenHash(
  client: SupabaseClient<Database>,
  tokenHash: string | null,
): Promise<InviteRedemptionResult> {
  if (!tokenHash || !TOKEN_HASH_REGEX.test(tokenHash)) {
    return { ok: false, errorCode: "invalid_token" };
  }

  try {
    const { data, error } = await client.rpc("accept_invite_from_cookie", {
      p_token: tokenHash,
    });

    if (error) {
      return { ok: false, errorCode: getInviteErrorCodeFromPostgrest(error) };
    }

    // Transitional fallback while older DB function versions may still return void.
    if (data == null) {
      return { ok: true, brandId: null };
    }

    const parsed = parseAcceptInviteRpcData(data);
    if (!parsed) {
      return { ok: false, errorCode: "accept_failed" };
    }

    if (parsed.status === "accepted") {
      return { ok: true, brandId: parsed.brand_id };
    }

    return {
      ok: false,
      errorCode: parsed.error_code ?? "accept_failed",
    };
  } catch {
    return { ok: false, errorCode: "accept_failed" };
  }
}
