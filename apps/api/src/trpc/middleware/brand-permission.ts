import type { Role } from "../../config/roles";
import type { TRPCContext } from "../init.js";

/**
 * Resolves the current request's brand and the user's role within that brand, then forwards control to `next` with an augmented context.
 *
 * The forwarded context always includes `brandId` and `role`; when the user is missing, the brand is missing, no membership is found, or an error occurs, both fields are set to `null`.
 *
 * @param opts.ctx - The TRPC request context to augment.
 * @param opts.next - Function invoked with the augmented context; receives `ctx` extended with `brandId: string | null` and `role: Role | null`.
 * @returns The value returned by `next`.
 */
export async function withBrandPermission<TReturn>(opts: {
  ctx: TRPCContext;
  next: (opts: {
    ctx: TRPCContext & { brandId: string | null; role: Role | null };
  }) => Promise<TReturn>;
}) {
  const { ctx, next } = opts;

  if (!ctx.user) return next({ ctx: { ...ctx, brandId: null, role: null } });

  const brandId = ctx.brandId ?? null;
  if (!brandId) return next({ ctx: { ...ctx, brandId, role: null } });

  const userId = ctx.user.id;

  try {
    const result = await ctx.db.query.brandMembers.findFirst({
      columns: {
        id: true,
        role: true,
      },
      where: (brandMembers, { eq, and }) =>
        and(
          eq(brandMembers.brandId, brandId),
          eq(brandMembers.userId, userId),
        ),
    });

    if (!result) {
      return next({ ctx: { ...ctx, brandId: null, role: null } });
    }

    const role = result.role as Role | null;
    return next({ ctx: { ...ctx, brandId, role } });
  } catch {
    return next({ ctx: { ...ctx, brandId: null, role: null } });
  }
}