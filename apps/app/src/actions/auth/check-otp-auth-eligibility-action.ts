"use server";

import { actionClient } from "@/actions/safe-action";
import { createClient } from "@v1/supabase/server";
import { z } from "zod";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type EligibilityStatus = "existing_account" | "pending_invite" | "not_found";

type RpcResponse = {
  data: unknown;
  error: {
    message: string;
  } | null;
};

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResponse>;
};

function parseBooleanRpcValue(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    return value.length > 0 ? parseBooleanRpcValue(value[0]) : null;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const candidate of [
      "has_pending_invite_email",
      "has_auth_user_email",
      "exists",
      "result",
    ]) {
      const next = record[candidate];
      if (typeof next === "boolean") return next;
    }
  }

  return null;
}

function assertBoolean(data: unknown, fnName: string): boolean {
  const parsed = parseBooleanRpcValue(data);
  if (parsed === null) {
    throw new Error(`Unexpected response from ${fnName}`);
  }
  return parsed;
}

export const checkOtpAuthEligibilityAction = actionClient
  .schema(schema)
  .action(async ({ parsedInput }) => {
    const email = parsedInput.email.trim().toLowerCase();
    const admin = (await createClient({
      admin: true,
    })) as unknown as RpcClient;

    const pendingInviteRes = await admin.rpc("has_pending_invite_email", {
      p_email: email,
    });
    if (pendingInviteRes.error) {
      throw new Error("Unable to verify invitation status.");
    }

    const hasPendingInvite = assertBoolean(
      pendingInviteRes.data,
      "has_pending_invite_email",
    );
    if (hasPendingInvite) {
      return { status: "pending_invite" as EligibilityStatus };
    }

    const authUserRes = await admin.rpc("has_auth_user_email", {
      p_email: email,
    });
    if (authUserRes.error) {
      throw new Error("Unable to verify account status.");
    }

    const hasExistingAccount = assertBoolean(
      authUserRes.data,
      "has_auth_user_email",
    );

    return {
      status: hasExistingAccount
        ? ("existing_account" as EligibilityStatus)
        : ("not_found" as EligibilityStatus),
    };
  });
