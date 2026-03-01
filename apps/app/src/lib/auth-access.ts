export const INVITE_REQUIRED_LOGIN_PATH = "/login?error=invite-required";
export const FORCE_SIGN_OUT_ROUTE = "/api/auth/force-signout";

export function sanitizeAppPath(
  path: string | null | undefined,
  fallback = "/",
): string {
  if (!path) return fallback;

  try {
    // Reject protocol-relative URLs and absolute URLs.
    if (path.startsWith("//") || /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(path)) {
      return fallback;
    }

    // Normalize to a single leading slash for local absolute paths.
    if (path.startsWith("/")) {
      return `/${path.replace(/^\/+/, "")}`;
    }

    // Parse relative paths safely and preserve query string.
    const url = new URL(path, "http://localhost");
    const normalizedPath = url.pathname.startsWith("/")
      ? url.pathname
      : `/${url.pathname}`;

    return `${normalizedPath}${url.search}`;
  } catch {
    return fallback;
  }
}

export function getForceSignOutPath(
  next: string = INVITE_REQUIRED_LOGIN_PATH,
): string {
  const safeNext = sanitizeAppPath(next, INVITE_REQUIRED_LOGIN_PATH);
  return `${FORCE_SIGN_OUT_ROUTE}?next=${encodeURIComponent(safeNext)}`;
}

export function isInviteRequiredPath(path: string): boolean {
  const safePath = sanitizeAppPath(path, "");
  if (!safePath) return false;

  const [pathname, queryString = ""] = safePath.split("?");
  if (pathname !== "/login") return false;

  const params = new URLSearchParams(queryString);
  return params.get("error") === "invite-required";
}
