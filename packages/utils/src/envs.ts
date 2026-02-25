export function getAppUrl() {
  // Explicit APP_URL takes precedence (set by Fly.io API deployments)
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Vercel environment detection (for Next.js apps running on Vercel)
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://app.avelero.com";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getEmailUrl() {
  if (process.env.NODE_ENV === "development") {
    return "http://localhost:3001";
  }

  return "https://avelero.com";
}

export function getWebsiteUrl() {
  if (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    return "https://avelero.com";
  }

  if (process.env.VERCEL_ENV === "preview") {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export function getCdnUrl() {
  return "https://cdn.avelero.com";
}

let cachedPlatformAdminEmailsRaw: string | undefined;
let cachedPlatformAdminEmails = new Set<string>();

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function getPlatformAdminEmails(): Set<string> {
  const raw = process.env.PLATFORM_ADMIN_EMAILS;

  if (raw !== cachedPlatformAdminEmailsRaw) {
    cachedPlatformAdminEmailsRaw = raw;
    cachedPlatformAdminEmails = new Set(
      (raw ?? "")
        .split(",")
        .map(normalizeEmail)
        .filter((email) => email.length > 0),
    );
  }

  return new Set(cachedPlatformAdminEmails);
}

export function isPlatformAdminEmail(
  email: string | null | undefined,
): boolean {
  if (!email) return false;
  return getPlatformAdminEmails().has(normalizeEmail(email));
}
