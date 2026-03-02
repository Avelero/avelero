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

function createServiceRoleClient(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) return null;

  return createSupabaseJsClient<Database>(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export async function isPlatformAdminEmailAllowlisted(
  email: string,
): Promise<{ allowed: boolean; unavailable: boolean }> {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail) {
    return { allowed: false, unavailable: true };
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return { allowed: false, unavailable: true };
  }

  const { data, error } = await admin
    .from("platform_admin_allowlist")
    .select("email")
    .ilike("email", normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { allowed: false, unavailable: true };
  }

  return { allowed: Boolean(data), unavailable: false };
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
