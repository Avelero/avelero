import type { Role } from "../../config/roles";
import type { TRPCContext } from "../init.js";

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
