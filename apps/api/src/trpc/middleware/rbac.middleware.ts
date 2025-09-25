import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../init";
import { ROLES, type Role } from "../../config/roles";

/**
 * Middleware to check if the authenticated user has one of the allowed roles.
 * Throws a TRPCError with code 'FORBIDDEN' if the user does not have the required role.
 *
 * @param allowedRoles An array of roles that are permitted to access the resource.
 * @returns A tRPC middleware that checks user roles.
 */
export const hasRole = (allowedRoles: Role[]) => {
  return protectedProcedure.use(async ({ ctx, next }) => {
    if (!ctx.user || !allowedRoles.includes(ctx.user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have the required role to access this resource.",
      });
    }
    return next();
  });
};