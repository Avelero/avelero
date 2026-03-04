"use server";

import { actionClient } from "@/actions/safe-action";
import {
  evaluateMainOtpStartPolicy,
  mapMainOtpStartSupabaseError,
  normalizeAuthEmail,
  type MainAuthErrorCode,
} from "@/lib/auth-policy";
import { createClient } from "@v1/supabase/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type StartOtpActionResult =
  | { ok: true }
  | { ok: false; errorCode: MainAuthErrorCode };

export const startOtpAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }): Promise<StartOtpActionResult> => {
    const normalizedEmail = normalizeAuthEmail(parsedInput.email);

    const policy = await evaluateMainOtpStartPolicy(normalizedEmail);
    if (!policy.ok) {
      return { ok: false, errorCode: policy.errorCode };
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
        errorCode: mapMainOtpStartSupabaseError({
          message: error.message,
          code: error.code,
          status: error.status,
        }),
      };
    }

    return { ok: true };
  });
