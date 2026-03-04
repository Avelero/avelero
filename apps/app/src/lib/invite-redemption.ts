import type { User } from "@supabase/supabase-js";
import { createClient } from "@v1/supabase/server";

export const INVITE_COOKIE_NAME = "brand_invite_token_hash";

type RedemptionStatus =
  | "accepted"
  | "no_cookie"
  | "no_user"
  | "mismatch"
  | "invalid_or_expired"
  | "unknown_error";

export interface InviteRedemptionResult {
  accepted: boolean;
  shouldClearCookie: boolean;
  status: RedemptionStatus;
}

function classifyInviteRpcError(error: {
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): Exclude<RedemptionStatus, "accepted" | "no_cookie" | "no_user"> {
  const combined = `${error.message ?? ""} ${error.details ?? ""} ${
    error.hint ?? ""
  }`.toLowerCase();

  if (
    combined.includes("invite does not belong to the current user") ||
    combined.includes("authenticated user email not found")
  ) {
    return "mismatch";
  }

  if (combined.includes("invite not found or expired")) {
    return "invalid_or_expired";
  }

  return "unknown_error";
}

export async function redeemInviteFromCookie(params: {
  cookieHash: string | null;
  user: User | null;
  client?: Awaited<ReturnType<typeof createClient>>;
}): Promise<InviteRedemptionResult> {
  const { cookieHash, user } = params;

  if (!cookieHash) {
    return {
      accepted: false,
      shouldClearCookie: false,
      status: "no_cookie",
    };
  }

  if (!user) {
    return {
      accepted: false,
      shouldClearCookie: false,
      status: "no_user",
    };
  }

  const supabase = params.client ?? (await createClient());

  try {
    const { error } = await supabase.rpc("accept_invite_from_cookie", {
      p_token: cookieHash,
    });

    if (!error) {
      return {
        accepted: true,
        shouldClearCookie: true,
        status: "accepted",
      };
    }

    const status = classifyInviteRpcError(error);

    // Clear cookie for deterministic hard failures.
    if (status === "mismatch" || status === "invalid_or_expired") {
      return {
        accepted: false,
        shouldClearCookie: true,
        status,
      };
    }

    // Unknown failures keep cookie so the flow can retry.
    return {
      accepted: false,
      shouldClearCookie: false,
      status,
    };
  } catch {
    return {
      accepted: false,
      shouldClearCookie: false,
      status: "unknown_error",
    };
  }
}
