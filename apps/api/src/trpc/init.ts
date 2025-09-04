import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { TRPCError, initTRPC } from "@trpc/server";
import type { Database } from "@v1/supabase/types";
import superjson from "superjson";

interface GeoContext {
  ip?: string | null;
}

export interface TRPCContext {
  supabase: SupabaseClient<Database>;
  supabaseAdmin?: SupabaseClient<Database> | null;
  user: User | null;
  geo: GeoContext;
  brandId?: string | null;
}

function createSupabaseForRequest(
  authHeader?: string | null,
): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
  return createSupabaseJsClient<Database>(url, anon, {
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

function createSupabaseAdmin(): SupabaseClient<Database> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY as string | undefined;
  if (!url || !serviceKey) return null;
  return createSupabaseJsClient<Database>(url, serviceKey);
}

export async function createTRPCContextFromHeaders(
  headers: Record<string, string | undefined>,
): Promise<TRPCContext> {
  const authHeader = headers.authorization ?? headers.Authorization;
  const ip = headers["x-forwarded-for"] || headers["x-real-ip"];
  const supabase = createSupabaseForRequest(authHeader ?? null);
  const supabaseAdmin = createSupabaseAdmin();

  // Extract bearer token and explicitly resolve user with it for reliability
  const bearerToken = authHeader
    ? authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : authHeader
    : undefined;

  const { data: userRes } = await supabase.auth.getUser(bearerToken);
  const user = userRes?.user ?? null;

  let brandId: string | null | undefined = undefined;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("brand_id")
      .eq("id", user.id)
      .single();
    brandId = (data as { brand_id: string | null } | null)?.brand_id ?? null;
  }

  return {
    supabase,
    supabaseAdmin,
    user,
    brandId,
    geo: { ip: ip ?? null },
  };
}

// Hono adapter wrapper: accepts Hono context shape ({ req: Request })
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

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
const withPrimaryDbMiddleware = t.middleware(async (opts) => {
  return opts.next();
});

const withTeamPermissionMiddleware = t.middleware(async (opts) => {
  const brandId = opts.ctx.brandId ?? null;
  return opts.next({ ctx: { ...opts.ctx, brandId } });
});

export const publicProcedure = t.procedure.use(withPrimaryDbMiddleware);

export const protectedProcedure = t.procedure
  .use(withTeamPermissionMiddleware)
  .use(withPrimaryDbMiddleware)
  .use(async (opts) => {
    const { user, brandId } = opts.ctx;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return opts.next({ ctx: { ...opts.ctx, user, brandId } });
  });
