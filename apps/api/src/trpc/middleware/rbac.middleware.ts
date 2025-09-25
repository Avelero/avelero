// apps/api/src/trpc/middleware/rbac.middleware.ts

import { TRPCError } from '@trpc/server';
import { t } from '../init';
import { hasPermission, Permission, Role } from '../../config/permissions';

export const enforceRbac = (requiredPermission: Permission) =>
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Not authenticated',
      });
    }

    const userRole = ctx.user.role as Role; // Assuming role is part of the session user
    if (!userRole || !hasPermission(userRole, requiredPermission)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    }

    return next({
      ctx: {
        // Infers the `session` as non-nullable
        session: ctx.session,
      },
    });
  });
