import { type Role, isRole } from "@api/config/roles.js";
import { resolveBrandAccessDecision } from "@api/lib/access-policy/resolve-brand-access-decision.js";
import { resolveSkuAccessDecision } from "@api/lib/access-policy/resolve-sku-access-decision.js";
import type {
  BrandAccessSnapshot,
  ResolvedBrandAccessDecision,
  ResolvedSkuAccessDecision,
} from "@api/lib/access-policy/types.js";
import type { TRPCContext } from "@api/trpc/init.ts";
import { getBrandAccessSnapshot } from "@v1/db/queries/brand";
import { logger } from "@v1/logger";

const BRAND_CONTEXT_CACHE = Symbol("brandContextCache");
const BRAND_ACCESS_CONTEXT_CACHE = Symbol("brandAccessContextCache");

type BrandContextCache = {
  brandId: string | null;
  role: Role | null;
};

export type BrandAccessContextCache = {
  snapshot: BrandAccessSnapshot;
  brandAccess: ResolvedBrandAccessDecision;
  skuAccess: ResolvedSkuAccessDecision;
};

type ContextWithBrandCache = TRPCContext & {
  [BRAND_CONTEXT_CACHE]?: BrandContextCache;
  [BRAND_ACCESS_CONTEXT_CACHE]?: BrandAccessContextCache;
};

/**
 * Resolves the active brand and role for the current request.
 *
 * The result is cached on the tRPC context so downstream middleware can reuse
 * it without issuing duplicate database lookups.
 *
 * @param ctx - Request-scoped tRPC context.
 * @returns Brand identifier and role when membership exists, otherwise nulls.
 */
export async function ensureBrandContext(
  ctx: TRPCContext,
): Promise<BrandContextCache> {
  const contextWithCache = ctx as ContextWithBrandCache;
  if (contextWithCache[BRAND_CONTEXT_CACHE]) {
    return contextWithCache[BRAND_CONTEXT_CACHE]!;
  }

  if (!ctx.user) {
    const anon = { brandId: null, role: null } as const;
    contextWithCache[BRAND_CONTEXT_CACHE] = anon;
    return anon;
  }

  const brandId = ctx.brandId ?? null;
  if (!brandId) {
    const missingBrand = { brandId: null, role: null } as const;
    contextWithCache[BRAND_CONTEXT_CACHE] = missingBrand;
    return missingBrand;
  }

  try {
    const membership = await ctx.db.query.brandMembers.findFirst({
      columns: {
        id: true,
        role: true,
      },
      where: (brandMembers, { eq, and }) =>
        and(
          eq(brandMembers.brandId, brandId),
          eq(brandMembers.userId, ctx.user!.id),
        ),
    });

    if (!membership) {
      const result = { brandId: null, role: null } as const;
      contextWithCache[BRAND_CONTEXT_CACHE] = result;
      return result;
    }

    const role = isRole(membership.role) ? membership.role : null;

    if (membership.role !== null && !role) {
      logger.warn(
        {
          userId: ctx.user!.id,
          brandId,
          role: membership.role,
        },
        "Invalid role stored for brand membership; defaulting to no permissions.",
      );
    }

    const result: BrandContextCache = {
      brandId,
      role,
    };

    contextWithCache[BRAND_CONTEXT_CACHE] = result;
    return result;
  } catch (error) {
    logger.error(
      {
        err: error instanceof Error ? error : undefined,
        userId: ctx.user!.id,
        brandId,
      },
      "Failed to load brand membership for request context.",
    );
    const result = { brandId: null, role: null } as const;
    contextWithCache[BRAND_CONTEXT_CACHE] = result;
    return result;
  }
}

/**
 * Resolves and caches access policy state for the active brand on this request.
 *
 * @param ctx - Request-scoped tRPC context with resolved brand role.
 * @returns Snapshot + computed brand and SKU access decisions.
 */
export async function ensureBrandAccessContext(
  ctx: TRPCContext & { brandId: string; role?: Role | null },
): Promise<BrandAccessContextCache> {
  const contextWithCache = ctx as ContextWithBrandCache;
  if (contextWithCache[BRAND_ACCESS_CONTEXT_CACHE]) {
    return contextWithCache[BRAND_ACCESS_CONTEXT_CACHE]!;
  }

  if (!ctx.brandId) {
    throw new Error("Active brand context required to resolve access policy");
  }

  const snapshot = await getBrandAccessSnapshot(ctx.db, ctx.brandId);
  const resolvedBrandAccess = resolveBrandAccessDecision({
    role: ctx.role ?? null,
    snapshot,
  });
  const skuAccess = resolveSkuAccessDecision({
    brandAccess: resolvedBrandAccess,
    snapshot,
    intendedCreateCount: 0,
  });
  const brandAccess: ResolvedBrandAccessDecision = {
    ...resolvedBrandAccess,
    capabilities: {
      ...resolvedBrandAccess.capabilities,
      canCreateSkus:
        resolvedBrandAccess.capabilities.canWriteBrandData &&
        skuAccess.status !== "blocked",
    },
  };

  const result: BrandAccessContextCache = {
    snapshot,
    brandAccess,
    skuAccess,
  };

  contextWithCache[BRAND_ACCESS_CONTEXT_CACHE] = result;
  return result;
}
