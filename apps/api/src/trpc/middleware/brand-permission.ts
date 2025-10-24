import { and, eq } from "drizzle-orm";
import { brandMembers } from "@v1/db/schema";
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

  try {
    const rows = await ctx.db
      .select({ id: brandMembers.id, role: brandMembers.role })
      .from(brandMembers)
      .where(
        and(
          eq(brandMembers.brandId, brandId),
          eq(brandMembers.userId, ctx.user.id),
        ),
      )
      .limit(1);

    if (!rows.length) {
      return next({ ctx: { ...ctx, brandId: null, role: null } });
    }

    const role = rows[0]?.role as Role | null;
    return next({ ctx: { ...ctx, brandId, role } });
  } catch {
    return next({ ctx: { ...ctx, brandId: null, role: null } });
  }
}
