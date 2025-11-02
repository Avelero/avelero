/**
 * Shared tRPC bootstrap utilities.
 *
 * This module builds the tRPC context used by every API procedure, including
 * Supabase clients, Drizzle database access, and role-aware middleware.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { TRPCError, initTRPC } from "@trpc/server";
import { db as drizzleDb } from "@v1/db/client";
import type { Database as DrizzleDatabase } from "@v1/db/client";
import type { Database as SupabaseDatabase } from "@v1/supabase/types";
import superjson from "superjson";
import type { Role } from "../config/roles";
import type { DataLoaders } from "../utils/dataloader.js";
import { createDataLoaders } from "../utils/dataloader.js";
import { noBrandSelected, unauthorized } from "../utils/errors.js";
import { ensureBrandContext } from "./middleware/auth/brand.js";

/**
 * Stores lightweight geographic hints sourced from request headers.
 *
 * The API only needs the remote IP at this stage, but the shape leaves room
 * for future enrichment such as geo lookups or regional rate limits.
 */
interface GeoContext {
  ip?: string | null;
}

/**
 * Fully hydrated context object passed to every tRPC procedure.
 *
 * Each property gives routers convenient access to authenticated Supabase
 * clients, the Drizzle database, and any derived brand metadata resolved by
 * middleware. Procedures should treat optional fields as potentially null.
 */
export interface TRPCContext {
  /** Tenant-specific Supabase client bound to the request's auth token. */
  supabase: SupabaseClient<SupabaseDatabase>;
  /** Elevated Supabase client created with the service role key when present. */
  supabaseAdmin?: SupabaseClient<SupabaseDatabase> | null;
  /** Authenticated Supabase user, or null when unauthenticated. */
  user: User | null;
  /** Minimal location context derived from forwarding headers. */
  geo: GeoContext;
  /** Active brand selected by the user, null when unresolved. */
  brandId?: string | null;
  /** Brand-specific role resolved via membership lookup. */
  role?: Role | null;
  /** Shared Drizzle database connection used for transactional work. */
  db: DrizzleDatabase;
  /** Request-scoped dataloaders for efficient batch loading and caching. */
  loaders: DataLoaders;
}

export type AuthenticatedTRPCContext = TRPCContext & {
  user: User;
  brandId: string | null;
  role: Role | null;
};

/**
 * Creates a Supabase client tailored to the incoming request.
 *
 * The helper attaches the Authorization header when available so that route
 * handlers can call Supabase APIs using the caller's session.
 *
 * @param authHeader - Authorization value supplied by the client, if any.
 * @returns Supabase client scoped to the given auth token.
 */
function createSupabaseForRequest(
  authHeader?: string | null,
): SupabaseClient<SupabaseDatabase> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createSupabaseJsClient<SupabaseDatabase>(url, anon, {
    global: authHeader
      ? {
          headers: {
            Authorization: authHeader.startsWith("Bearer ")
              ? authHeader
              : `Bearer ${authHeader}`,
          },
        }
      : undefined,
  });
}

/**
 * Builds a service-role Supabase client when the secret is configured.
 *
 * This client is used sparingly for privileged actions such as deleting
 * storage objects or removing users from the auth system.
 *
 * @returns Admin client when both URL and service key are present, otherwise null.
 */
function createSupabaseAdmin(): SupabaseClient<SupabaseDatabase> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY as string | undefined;
  if (!url || !serviceKey) return null;
  return createSupabaseJsClient<SupabaseDatabase>(url, serviceKey);
}

/**
 * Resolves the tRPC context from a simplified headers record.
 *
 * This variant makes it easy to reuse the logic across edge adapters that
 * provide their own header abstractions.
 *
 * @param headers - Lowercase header map sourced from the inbound request.
 * @returns Fully resolved tRPC context for downstream procedures.
 */
export async function createTRPCContextFromHeaders(
  headers: Record<string, string | undefined>,
): Promise<TRPCContext> {
  const authHeader = headers.authorization ?? headers.Authorization;
  const ip = headers["x-forwarded-for"] || headers["x-real-ip"];
  const supabase = createSupabaseForRequest(authHeader ?? null);
  const supabaseAdmin = createSupabaseAdmin();
  const db = drizzleDb;

  // Extract bearer token and explicitly resolve user with it for reliability
  const bearerToken = authHeader
    ? authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : authHeader
    : undefined;

  let user: User | null = null;
  if (bearerToken) {
    const { data: userRes } = await supabase.auth.getUser(bearerToken);
    user = userRes?.user ?? null;
  }

  let brandId: string | null | undefined = undefined;
  if (user) {
    const userRow = await db.query.users.findFirst({
      columns: { brandId: true },
      where: (tbl, { eq }) => eq(tbl.id, user.id),
    });
    brandId = userRow?.brandId ?? null;
  }

  return {
    supabase,
    supabaseAdmin,
    user,
    brandId,
    geo: { ip: ip ?? null },
    db,
    loaders: createDataLoaders(db),
  };
}

/**
 * Adapts Hono's request context into the tRPC context builder.
 *
 * Hono exposes both a helper method and the raw Fetch API headers. This
 * function normalizes those sources and forwards them to
 * `createTRPCContextFromHeaders`.
 *
 * @param c - Hono context containing the Fetch request instance.
 * @returns tRPC context populated from the incoming request.
 */
export async function createTRPCContext(c: {
  req: Request;
}): Promise<TRPCContext> {
  // Support both Hono's c.req.header(name) and Web Request headers.get(name)
  const reqLike = c.req as Request &
    Partial<{ header: (name: string) => string | undefined }>;
  const getHeader = (name: string): string | undefined => {
    const viaMethod: string | undefined = reqLike.header?.(name);
    if (viaMethod) return viaMethod;
    try {
      const viaHeaders =
        c.req.headers?.get?.(name) ?? c.req.headers?.get?.(name.toLowerCase());
      return viaHeaders ?? undefined;
    } catch {
      return undefined;
    }
  };

  const authorization =
    getHeader("authorization") ?? getHeader("Authorization");
  const xForwardedFor = getHeader("x-forwarded-for");
  const xRealIp = getHeader("x-real-ip");

  const headerRecord: Record<string, string | undefined> = {
    authorization,
    "x-forwarded-for": xForwardedFor,
    "x-real-ip": xRealIp,
  };

  return createTRPCContextFromHeaders(headerRecord);
}

/**
 * Global tRPC instance configured with the shared context and transformers.
 */
export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

/**
 * Convenience export for defining routers across the codebase.
 */
export const createTRPCRouter = t.router;
/**
 * Convenience export for merging modular routers.
 */
export const mergeTRPCRouters = t.mergeRouters;

/**
 * Resolves brand membership information and attaches it to the context.
 */
const withBrandContext = t.middleware(async ({ ctx, next }) => {
  const brandContext = await ensureBrandContext(ctx);
  return next({
    ctx: {
      ...ctx,
      brandId: brandContext.brandId,
      role: brandContext.role,
    },
  });
});

/**
 * Middleware that enforces the presence of an active brand.
 *
 * @returns Middleware enforcing a non-null `brandId`.
 */
const requireBrand = t.middleware(({ ctx, next }) => {
  const authedCtx = ctx as AuthenticatedTRPCContext;

  if (!authedCtx.brandId) {
    throw noBrandSelected();
  }

  const brandId = authedCtx.brandId as string;

  return next({
    ctx: {
      ...authedCtx,
      brandId,
    },
  });
});

/**
 * Base procedure for public endpoints that still require database access.
 */
export const publicProcedure = t.procedure;

/**
 * Procedure variant that enforces authentication and brand membership.
 */
export const protectedProcedure = t.procedure
  .use(withBrandContext)
  .use(async (opts) => {
    const { user, brandId, role } = opts.ctx;
    if (!user) throw unauthorized();

    // Explicitly cast user to User (non-nullable)
    const authenticatedUser = user as User;

    // Refine the type of ctx to ensure user is non-nullable
    const authedCtx: AuthenticatedTRPCContext = {
      ...opts.ctx,
      user: authenticatedUser,
      brandId: brandId ?? null,
      role: role ?? null,
    };

    return opts.next({ ctx: authedCtx });
  });

/**
 * Procedure that requires an active brand context for mutations.
 *
 * Throws a BAD_REQUEST error when no brand is active, signaling that the
 * client should prompt the user to select or create a brand before proceeding.
 *
 * @returns Context with non-null brandId guaranteed.
 */
export const brandRequiredProcedure = protectedProcedure.use(requireBrand);

/**
 * Creates type-safe server callers for SSR and worker contexts.
 */
export const createCallerFactory = t.createCallerFactory;
