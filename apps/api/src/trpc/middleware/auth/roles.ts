import { TRPCError } from "@trpc/server";
import type { Role } from "@api/config/roles.js";
import { t } from "@api/trpc/init.ts";

/**
 * Middleware that ensures the caller possesses one of the required roles.
 *
 * @param allowedRoles - Permitted brand roles.
 * @returns Middleware instance for use with `protectedProcedure`.
 */
export const hasRole = (allowedRoles: readonly Role[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.role || !allowedRoles.includes(ctx.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have the required role to access this resource.",
      });
    }

    return next();
  });
