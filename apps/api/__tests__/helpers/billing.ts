/**
 * Shared billing test helpers.
 *
 * Extracts commonly used utilities across billing integration tests
 * to eliminate duplication and provide a consistent test setup.
 */
import { spyOn } from "bun:test";
import { db as appDb } from "@v1/db/client";
import * as schema from "@v1/db/schema";
import { testDb } from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../src/trpc/init";

export type BrandRole = "owner" | "member" | "avelero";
export type BrandPhase =
  | "demo"
  | "trial"
  | "expired"
  | "active"
  | "past_due"
  | "suspended"
  | "cancelled";

/**
 * Creates an authenticated tRPC context for billing router tests.
 */
export function createMockContext(params: {
  userId: string;
  userEmail: string;
  brandId?: string | null;
  role?: BrandRole | null;
}): AuthenticatedTRPCContext {
  return {
    user: {
      id: params.userId,
      email: params.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: params.brandId ?? null,
    role: params.role ?? null,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Grants brand membership to a test user.
 */
export async function addBrandMember(
  userId: string,
  brandId: string,
  role: BrandRole = "owner",
) {
  await testDb.insert(schema.brandMembers).values({
    userId,
    brandId,
    role,
  });
}

/**
 * Seeds the lifecycle, plan, and billing rows needed for billing tests.
 */
export async function setBrandSubscriptionState(params: {
  brandId: string;
  phase: BrandPhase;
  planType?: "starter" | "growth" | "scale" | "enterprise" | null;
  billingInterval?: "quarterly" | "yearly" | null;
  trialEndsAt?: string | null;
  trialStartedAt?: string | null;
  billingMode?: "stripe_checkout" | "stripe_invoice" | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  pastDueSince?: string | null;
  pendingCancellation?: boolean;
  billingOverride?: "none" | "temporary_allow" | "temporary_block";
  billingOverrideExpiresAt?: string | null;
  hasImpactPredictions?: boolean;
  totalCredits?: number | null;
  onboardingDiscountUsed?: boolean;
  variantGlobalCap?: number | null;
}) {
  const now = new Date().toISOString();

  // Auto-fill period dates when a subscription ID is set but no period was
  // provided.  This prevents the brand-access middleware from calling
  // syncStripeSubscriptionProjectionById (which would hit the real Stripe API).
  const currentPeriodStart =
    params.currentPeriodStart ??
    (params.stripeSubscriptionId ? daysAgo(30) : null);
  const currentPeriodEnd =
    params.currentPeriodEnd ??
    (params.stripeSubscriptionId ? daysFromNow(30) : null);

  await testDb
    .insert(schema.brandLifecycle)
    .values({
      brandId: params.brandId,
      phase: params.phase,
      phaseChangedAt: now,
      trialEndsAt: params.trialEndsAt ?? null,
      trialStartedAt: params.trialStartedAt ?? null,
      cancelledAt: params.phase === "cancelled" ? now : null,
      hardDeleteAfter: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandLifecycle.brandId,
      set: {
        phase: params.phase,
        phaseChangedAt: now,
        trialEndsAt: params.trialEndsAt ?? null,
        trialStartedAt: params.trialStartedAt ?? null,
        cancelledAt: params.phase === "cancelled" ? now : null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandBilling)
    .values({
      brandId: params.brandId,
      billingMode: params.billingMode ?? null,
      stripeCustomerId: params.stripeCustomerId ?? null,
      stripeSubscriptionId: params.stripeSubscriptionId ?? null,
      planCurrency: "EUR",
      customPriceCents: null,
      currentPeriodStart,
      currentPeriodEnd,
      pastDueSince: params.pastDueSince ?? null,
      pendingCancellation: params.pendingCancellation ?? false,
      billingAccessOverride: params.billingOverride ?? "none",
      billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandBilling.brandId,
      set: {
        billingMode: params.billingMode ?? null,
        stripeCustomerId: params.stripeCustomerId ?? null,
        stripeSubscriptionId: params.stripeSubscriptionId ?? null,
        planCurrency: "EUR",
        customPriceCents: null,
        currentPeriodStart,
        currentPeriodEnd,
        pastDueSince: params.pastDueSince ?? null,
        pendingCancellation: params.pendingCancellation ?? false,
        billingAccessOverride: params.billingOverride ?? "none",
        billingOverrideExpiresAt: params.billingOverrideExpiresAt ?? null,
        updatedAt: now,
      },
    });

  await testDb
    .insert(schema.brandPlan)
    .values({
      brandId: params.brandId,
      planType: params.planType ?? null,
      planSelectedAt: null,
      billingInterval: params.billingInterval ?? null,
      hasImpactPredictions: params.hasImpactPredictions ?? false,
      totalCredits: params.totalCredits ?? 50,
      onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
      variantGlobalCap: params.variantGlobalCap ?? null,
      maxSeats: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.brandPlan.brandId,
      set: {
        planType: params.planType ?? null,
        planSelectedAt: null,
        billingInterval: params.billingInterval ?? null,
        hasImpactPredictions: params.hasImpactPredictions ?? false,
        totalCredits: params.totalCredits ?? 50,
        onboardingDiscountUsed: params.onboardingDiscountUsed ?? false,
        variantGlobalCap: params.variantGlobalCap ?? null,
        maxSeats: null,
        updatedAt: now,
      },
    });
}

const APP_DB_METHOD_NAMES = [
  "select",
  "insert",
  "update",
  "delete",
  "execute",
  "query",
  "transaction",
] as const;

type AppDbMethodName = (typeof APP_DB_METHOD_NAMES)[number];

/**
 * Routes the app DB proxy through the single-connection test DB.
 * Returns a cleanup function to restore the original methods.
 */
export function bindAppDbToTestDb(): () => void {
  const appDbProxy = appDb as Record<AppDbMethodName, unknown>;
  const testDbProxy = testDb as Record<AppDbMethodName, unknown>;
  const originalMethods = Object.fromEntries(
    APP_DB_METHOD_NAMES.map((name) => [name, appDbProxy[name]]),
  ) as Record<AppDbMethodName, unknown>;

  for (const name of APP_DB_METHOD_NAMES) {
    const method = testDbProxy[name];
    appDbProxy[name] =
      typeof method === "function"
        ? (...args: unknown[]) =>
            (method as (...args: unknown[]) => unknown).apply(testDb, args)
        : method;
  }

  return () => {
    for (const name of APP_DB_METHOD_NAMES) {
      appDbProxy[name] = originalMethods[name];
    }
  };
}

/**
 * Captures structured billing logs emitted during a single async action.
 */
export async function captureBillingLogs<T>(
  action: () => Promise<T>,
): Promise<{ result: T; logs: Array<Record<string, unknown>> }> {
  const chunks: string[] = [];
  const writeSpy = spyOn(process.stdout, "write").mockImplementation(
    ((chunk: string | Uint8Array, encoding?: unknown, callback?: unknown) => {
      chunks.push(
        typeof chunk === "string"
          ? chunk
          : Buffer.from(chunk).toString("utf8"),
      );

      if (typeof encoding === "function") {
        encoding();
      }

      if (typeof callback === "function") {
        callback();
      }

      return true;
    }) as typeof process.stdout.write,
  );

  try {
    const result = await action();
    await Promise.resolve();

    const logs = chunks
      .join("")
      .split("\n")
      .filter((line) => line.length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as Record<string, unknown>];
        } catch {
          return [];
        }
      });

    return { result, logs };
  } finally {
    writeSpy.mockRestore();
  }
}

/** Returns an ISO timestamp N days in the past. */
export function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

/** Returns an ISO timestamp N days in the future. */
export function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}
