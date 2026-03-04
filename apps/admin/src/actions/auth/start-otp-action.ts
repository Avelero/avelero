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
  | { ok: false; errorCode: AdminAuthErrorCode };

export const startOtpAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }): Promise<StartOtpActionResult> => {
    const normalizedEmail = normalizeAuthEmail(parsedInput.email);
    const allowlistAccess = await isPlatformAdminEmailAllowlisted(normalizedEmail);

    if (allowlistAccess.unavailable) {
      return { ok: false, errorCode: "auth-unavailable" };
    }

    if (!allowlistAccess.allowed) {
      return { ok: false, errorCode: "auth-denied" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      return {
        ok: false,
        errorCode: mapAdminOtpStartSupabaseError({
          message: error.message,
          code: error.code,
          status: error.status,
        }),
      };
    }

    return { ok: true };
  });
