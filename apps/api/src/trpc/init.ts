import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { TRPCError, initTRPC } from "@trpc/server";
import { db as drizzleDb } from "@v1/db/client";
import type { Database as DrizzleDatabase } from "@v1/db/client";
import {
  type BrandAccessManager,
  createBrandAccessManager,
} from "@v1/db/queries";
import type {
  BrandAccessResult,
  BrandContext,
  BrandMembership,
  UserContext,
} from "@v1/db/schemas/shared";
import type { Database as SupabaseDatabase } from "@v1/supabase/types";
import superjson from "superjson";
import { ZodError } from "zod";
import type { Role } from "../config/roles";
import { withBrandPermission } from "./middleware/brand-permission";

interface GeoContext {
  ip?: string | null;
}

/**
 * Enhanced tRPC context with comprehensive brand scoping and user information
 * Provides all necessary data for multi-tenant operations with proper access control
 */
export interface TRPCContext {
  // Database and external service clients
  supabase: SupabaseClient<SupabaseDatabase>;
  supabaseAdmin?: SupabaseClient<SupabaseDatabase> | null;
  db: DrizzleDatabase;

  // User authentication and identification
  user: User | null;
  geo: GeoContext;

  // Legacy brand context (maintained for backward compatibility)
  brandId?: string | null;
  role?: Role | null;

  // Enhanced brand context information
  brandContext?: BrandContext | null;
  userContext?: UserContext | null;
  brandAccessManager?: BrandAccessManager | null;

  // Request metadata for tracking and debugging
  requestId?: string;
  timestamp: Date;
}

function createSupabaseForRequest(
  authHeader?: string | null,
): SupabaseClient<SupabaseDatabase> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anon) {
    throw new Error(
      "Missing required Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY",
    );
  }

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

function createSupabaseAdmin(): SupabaseClient<SupabaseDatabase> | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !serviceKey) {
    console.warn("⚠️  Supabase admin client not available - missing service key");
    return null;
  }
  return createSupabaseJsClient<SupabaseDatabase>(url, serviceKey);
}

export async function createTRPCContextFromHeaders(
  headers: Record<string, string | undefined>,
): Promise<TRPCContext> {
  const authHeader = headers.authorization ?? headers.Authorization;
  const ip = headers["x-forwarded-for"] || headers["x-real-ip"];
  const requestId =
    headers["x-request-id"] ||
    `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const supabase = createSupabaseForRequest(authHeader ?? null);
  const supabaseAdmin = createSupabaseAdmin();
  const db = drizzleDb;

  // Extract bearer token and explicitly resolve user with it for reliability
  const bearerToken = authHeader
    ? authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : authHeader
    : undefined;

  const { data: userRes } = await supabase.auth.getUser(bearerToken);
  const user = userRes?.user ?? null;

  // Legacy brand ID retrieval (maintained for backward compatibility)
  let brandId: string | null | undefined = undefined;
  let brandContext: BrandContext | null = null;
  let userContext: UserContext | null = null;
  let brandAccessManager: BrandAccessManager | null = null;

  if (user) {
    try {
      // Get user's primary brand and full information
      const { data: userData } = await supabase
        .from("users")
        .select("brand_id, email, full_name")
        .eq("id", user.id)
        .single();

      brandId = userData?.brand_id ?? null;

      // Get all brand memberships for enhanced context
      const { data: memberships } = await supabase
        .from("users_on_brand")
        .select(`
          user_id,
          brand_id,
          role,
          created_at
        `)
        .eq("user_id", user.id);

      if (memberships && memberships.length > 0) {
        // Convert to BrandMembership format
        const brandMemberships: BrandMembership[] = memberships.map((m) => ({
          userId: m.user_id,
          brandId: m.brand_id,
          role: m.role as "owner" | "member",
          joinedAt: new Date(m.created_at),
          isActive: true, // Assuming active if in the table
        }));

        // Create enhanced user context
        userContext = {
          userId: user.id,
          email: userData?.email || user.email || "",
          fullName: userData?.full_name || undefined,
          primaryBrandId: brandId,
          currentBrand: undefined, // Will be set below if brandId exists
          accessibleBrands: brandMemberships.map((m) => ({
            brandId: m.brandId,
            role: m.role,
            permissions:
              m.role === "owner"
                ? (["read", "write", "admin", "owner"] as const)
                : (["read", "write"] as const),
            isBrandOwner: m.role === "owner",
            canAccessBrand: m.isActive,
          })),
          globalRole: brandMemberships.some((m) => m.role === "owner")
            ? "owner"
            : "member",
        };

        // Set current brand context if user has a primary brand
        if (brandId) {
          const currentMembership = brandMemberships.find(
            (m) => m.brandId === brandId,
          );
          if (currentMembership) {
            brandContext = {
              brandId: currentMembership.brandId,
              role: currentMembership.role,
              permissions:
                currentMembership.role === "owner"
                  ? (["read", "write", "admin", "owner"] as const)
                  : (["read", "write"] as const),
              isBrandOwner: currentMembership.role === "owner",
              canAccessBrand: currentMembership.isActive,
            };
            userContext.currentBrand = brandContext;
          }
        }

        // Create brand access manager for dynamic brand operations
        brandAccessManager = createBrandAccessManager(
          brandMemberships,
          brandId,
        );
      }
    } catch (error) {
      console.error("Error fetching enhanced brand context:", error);
      // Fall back to basic context if enhanced context fails
    }
  }

  return {
    supabase,
    supabaseAdmin,
    user,
    brandId,
    geo: { ip: ip ?? null },
    db,
    brandContext,
    userContext,
    brandAccessManager,
    requestId,
    timestamp: new Date(),
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

export const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
const withPrimaryDbMiddleware = t.middleware(async (opts) => {
  return opts.next();
});

const withBrandPermissionMiddleware = t.middleware(async (opts) => {
  return withBrandPermission({ ctx: opts.ctx, next: opts.next });
});

export const publicProcedure = t.procedure.use(withPrimaryDbMiddleware);

/**
 * Enhanced protected procedure with comprehensive brand context
 * Ensures user is authenticated and provides all brand-related utilities
 */
export const protectedProcedure = t.procedure
  .use(withBrandPermissionMiddleware)
  .use(withPrimaryDbMiddleware)
  .use(async (opts) => {
    const {
      user,
      brandId,
      role,
      brandContext,
      userContext,
      brandAccessManager,
    } = opts.ctx;
    if (!user)
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Not authenticated",
      });

    // Explicitly cast user to User (non-nullable)
    const authenticatedUser = user as User;

    // Create enhanced context with brand utilities
    const enhancedCtx = {
      ...opts.ctx,
      user: authenticatedUser,
      brandId,
      role,
      brandContext,
      userContext,
      brandAccessManager,

      // Helper methods for brand operations
      helpers: {
        /**
         * Validate access to a specific brand
         */
        validateBrandAccess: (targetBrandId: string) => {
          if (!brandAccessManager) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Brand access manager not available",
            });
          }
          return brandAccessManager.validateAccess(targetBrandId);
        },

        /**
         * Check if user can perform operation in current brand
         */
        canPerformOperation: (operation: string) => {
          if (!brandContext) return false;
          const role = brandContext.role;
          if (!role) return false;

          // Import canPerformOperation here to avoid circular dependencies
          const operationPermissionMap: Record<string, string> = {
            read: "read",
            create: "write",
            update: "write",
            delete: "write",
            bulk_update: "admin",
            bulk_delete: "admin",
            export: "admin",
            import: "admin",
            manage_members: "owner",
            manage_settings: "owner",
            manage_billing: "owner",
          };

          const requiredPermission = operationPermissionMap[operation];
          if (!requiredPermission) return false;

          const rolePermissions =
            role === "owner"
              ? ["read", "write", "admin", "owner"]
              : ["read", "write"];

          return rolePermissions.includes(requiredPermission);
        },

        /**
         * Get current brand ID or throw error
         */
        requireBrandId: () => {
          if (!brandId) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Brand context required for this operation",
            });
          }
          return brandId;
        },

        /**
         * Get current brand context or throw error
         */
        requireBrandContext: () => {
          if (!brandContext) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Brand context required for this operation",
            });
          }
          return brandContext;
        },

        /**
         * Switch user's active brand (if they have access)
         */
        switchBrand: (newBrandId: string) => {
          if (!brandAccessManager) {
            throw new TRPCError({
              code: "INTERNAL_SERVER_ERROR",
              message: "Brand access manager not available",
            });
          }
          return brandAccessManager.switchBrand(newBrandId);
        },

        /**
         * Validate operation permission in current brand
         */
        requireOperationPermission: (operation: string) => {
          const hasPermission =
            enhancedCtx.helpers.canPerformOperation(operation);
          if (!hasPermission) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Insufficient permissions for operation: ${operation}`,
            });
          }
        },
      },
    } as TRPCContext & {
      user: User;
      brandId: string | null;
      role: Role | null;
      brandContext: BrandContext | null;
      userContext: UserContext | null;
      brandAccessManager: BrandAccessManager | null;
      helpers: {
        validateBrandAccess: (targetBrandId: string) => BrandAccessResult;
        canPerformOperation: (operation: string) => boolean;
        requireBrandId: () => string;
        requireBrandContext: () => BrandContext;
        switchBrand: (newBrandId: string) => {
          success: boolean;
          context?: BrandContext;
          error?: string;
        };
        requireOperationPermission: (operation: string) => void;
      };
    };

    return opts.next({ ctx: enhancedCtx });
  });
