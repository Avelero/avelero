import { env } from "@/env.mjs";

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

const allowlist = new Set(
  env.PLATFORM_ADMIN_EMAILS.split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean),
);

export function isAdminEmailAllowed(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && allowlist.has(normalized);
}
