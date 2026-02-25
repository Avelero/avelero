import "server-only";

let cachedRawValue: string | undefined;
let cachedEmails = new Set<string>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getPlatformAdminEmails() {
  const raw = process.env.PLATFORM_ADMIN_EMAILS;

  if (raw !== cachedRawValue) {
    cachedRawValue = raw;
    cachedEmails = new Set(
      (raw ?? "")
        .split(",")
        .map(normalizeEmail)
        .filter((email) => email.length > 0),
    );
  }

  return cachedEmails;
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getPlatformAdminEmails().has(normalizeEmail(email));
}
