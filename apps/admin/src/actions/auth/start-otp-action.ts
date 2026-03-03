"use server";

import { actionClient } from "@/actions/safe-action";
import {
  isPlatformAdminEmailAllowlisted,
  mapAdminOtpStartSupabaseError,
  normalizeAuthEmail,
  type AdminAuthErrorCode,
} from "@/lib/platform-admin-access";
import { createClient } from "@v1/supabase/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type StartOtpActionResult =
  | { ok: true }
  | {
      ok: false;
      errorCode: AdminAuthErrorCode;
      debug?: Record<string, unknown>;
    };

export const startOtpAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }): Promise<StartOtpActionResult> => {
    const normalizedEmail = normalizeAuthEmail(parsedInput.email);
    const allowlistAccess = await isPlatformAdminEmailAllowlisted(normalizedEmail);

    if (allowlistAccess.unavailable) {
      return {
        ok: false,
        errorCode: "auth-unavailable",
        debug: {
          stage: "allowlist-check",
          allowlistDebug: allowlistAccess.debug,
        },
      };
    }

    if (!allowlistAccess.allowed) {
      return {
        ok: false,
        errorCode: "auth-denied",
        debug: {
          stage: "allowlist-check",
          allowlistDebug: allowlistAccess.debug,
        },
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      const mappedErrorCode = mapAdminOtpStartSupabaseError({
        message: error.message,
        code: error.code,
        status: error.status,
      });

      return {
        ok: false,
        errorCode: mappedErrorCode,
        debug: {
          stage: "otp-send",
          supabaseError: {
            message: error.message ?? null,
            code: error.code ?? null,
            status: error.status ?? null,
          },
        },
      };
    }

    return { ok: true };
  });
