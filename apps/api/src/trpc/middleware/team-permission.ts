import type { TRPCContext } from "../init.js";

export async function withTeamPermission<TReturn>(opts: {
  ctx: TRPCContext;
  next: (opts: {
    ctx: TRPCContext & { brandId: string | null };
  }) => Promise<TReturn>;
}) {
  const { ctx, next } = opts;

  // If user is not logged in, enforce elsewhere (protectedProcedure)
  if (!ctx.user) return next({ ctx: { ...ctx, brandId: null } });

  // brandId may be null if user has not selected/created a brand yet
  const brandId = ctx.brandId ?? null;

  // If a brand is set, ensure membership exists. Supabase RLS will enforce on data access;
  // here we only attach the brandId to ctx and allow routers to require it when needed.
  return next({ ctx: { ...ctx, brandId } });
}
