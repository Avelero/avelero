import { isPlatformAdminEmail } from "@v1/utils/envs";
import { forbidden } from "@api/utils/errors.js";

/**
 * Middleware that restricts access to platform-level admin users.
 *
 * Uses an explicit email allowlist (`PLATFORM_ADMIN_EMAILS`) and is intended for
 * founder/internal operational tooling (e.g. /admin routes).
 */
export function assertPlatformAdmin(ctx: {
  user?: { email?: string | null } | null;
}) {
  if (!isPlatformAdminEmail(ctx.user?.email)) {
    throw forbidden("Platform admin access required");
  }
}
