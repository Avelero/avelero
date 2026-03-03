import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

export type AdminAuthErrorCode =
  | "auth-denied"
  | "auth-rate-limited"
  | "auth-unavailable";

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

type ErrorDebug = {
  message: string | null;
  code: string | null;
  details: string | null;
  hint: string | null;
  status: number | null;
};

export type PlatformAdminAllowlistDebug =
  | { stage: "invalid-email" }
  | {
      stage: "missing-service-role-config";
      missingUrl: boolean;
      missingServiceKey: boolean;
    }
  | { stage: "allowlist-rpc-error"; rpcError: ErrorDebug }
  | { stage: "allowlist-hit" }
  | { stage: "allowlist-miss" };

function toErrorDebug(
  error:
    | {
        message?: string;
        code?: string;
        details?: string;
        hint?: string;
        status?: number;
      }
    | null
    | undefined,
): ErrorDebug {
  return {
    message: error?.message ?? null,
    code: error?.code ?? null,
    details: error?.details ?? null,
    hint: error?.hint ?? null,
    status: typeof error?.status === "number" ? error.status : null,
  };
}

function createServiceRoleClient(): {
  client: SupabaseClient<Database> | null;
  missingUrl: boolean;
  missingServiceKey: boolean;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    return {
      client: null,
      missingUrl: !url,
      missingServiceKey: !serviceKey,
    };
  }

  return {
    client: createSupabaseJsClient<Database>(url, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
    missingUrl: false,
    missingServiceKey: false,
  };
}

export type PlatformAdminAllowlistAccess = {
  allowed: boolean;
  unavailable: boolean;
  debug: PlatformAdminAllowlistDebug;
};

export async function isPlatformAdminEmailAllowlisted(
  email: string,
): Promise<PlatformAdminAllowlistAccess> {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) {
    return {
      allowed: false,
      unavailable: true,
      debug: { stage: "invalid-email" },
    };
  }

  const { client: admin, missingUrl, missingServiceKey } =
    createServiceRoleClient();
  if (!admin) {
    return {
      allowed: false,
      unavailable: true,
      debug: {
        stage: "missing-service-role-config",
        missingUrl,
        missingServiceKey,
      },
    };
  }

  const { data, error } = await admin.rpc("has_platform_admin_email", {
    p_email: normalizedEmail,
  });

  if (error) {
    return {
      allowed: false,
      unavailable: true,
      debug: {
        stage: "allowlist-rpc-error",
        rpcError: toErrorDebug(error),
      },
    };
  }

  return {
    allowed: data === true,
    unavailable: false,
    debug: { stage: data === true ? "allowlist-hit" : "allowlist-miss" },
  };
}

export async function getPlatformAdminActorAccess(
  supabase: SupabaseClient<Database>,
): Promise<{ allowed: boolean; unavailable: boolean }> {
  const { data, error } = await supabase.rpc("is_platform_admin_actor");

  if (error) {
    return { allowed: false, unavailable: true };
  }

  return { allowed: data === true, unavailable: false };
}

type AuthOtpError = {
  message?: string;
  code?: string;
  status?: number;
} | null;

export function mapAdminOtpStartSupabaseError(
  error: AuthOtpError,
): AdminAuthErrorCode {
  const message = error?.message?.toLowerCase() ?? "";

  if (
    error?.status === 429 ||
    message.includes("too many requests") ||
    message.includes("rate limit") ||
    message.includes("for security purposes")
  ) {
    return "auth-rate-limited";
  }

  if (
    message.includes("auth_gate_denied") ||
    message.includes("auth gate denied") ||
    message.includes("otp_disabled") ||
    message.includes("signups not allowed")
  ) {
    return "auth-denied";
  }

  return "auth-unavailable";
}
