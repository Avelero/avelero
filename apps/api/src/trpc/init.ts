import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import type { Database } from "@v1/supabase/types";

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

function createSupabaseForRequest(authHeader?: string | null): SupabaseClient<Database> {
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

export async function createTRPCContextFromHeaders(headers: Record<string, string | undefined>): Promise<TRPCContext> {
  const authHeader = headers["authorization"] ?? headers["Authorization"];
  const ip = headers["x-forwarded-for"] || headers["x-real-ip"];
  const supabase = createSupabaseForRequest(authHeader ?? null);
  const supabaseAdmin = createSupabaseAdmin();

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes?.user ?? null;

  let brandId: string | null | undefined = undefined;
  if (user) {
    const { data } = await supabase
      .from("users")
      .select("brand_id")
      .eq("id", user.id)
      .single();
    brandId = (data as any)?.brand_id ?? null;
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
export async function createTRPCContext(c: { req: Request }): Promise<TRPCContext> {
  const headers = Object.fromEntries(c.req.headers as any) as Record<string, string | undefined>;
  return createTRPCContextFromHeaders(headers);
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
  .use(async (opts: any) => {
    const { user, brandId } = opts.ctx;
    if (!user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return opts.next({ ctx: { ...opts.ctx, user, brandId } });
  });


