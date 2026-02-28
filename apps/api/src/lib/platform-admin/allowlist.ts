function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() ?? "";
}

const platformAdminEmailAllowlist = new Set(
  (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => normalizeEmail(email))
    .filter(Boolean),
);

export function isPlatformAdminEmail(email: string | null | undefined) {
  const normalized = normalizeEmail(email);
  return normalized.length > 0 && platformAdminEmailAllowlist.has(normalized);
}

