/**
 * Brand SKU usage queries and credit-based publish enforcement helpers.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { brandPlan, productVariants, products } from "../../schema";
import type { BrandAccessSnapshotRow } from "./access";

type DateLike = Date | string;

export const FREE_CREDITS = 50;
export type ActiveSkuBudgetKind = "credits";

export interface CreditBudget {
  totalCredits: number;
  publishedCount: number;
  remaining: number;
  utilization: number;
}

export interface DerivedSkuAccessBudget {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

export interface DerivedActiveSkuBudget extends DerivedSkuAccessBudget {
  kind: ActiveSkuBudgetKind | null;
  phase:
    | "demo"
    | "trial"
    | "expired"
    | "active"
    | "past_due"
    | "suspended"
    | "cancelled"
    | "none";
  totalCredits: number;
  publishedCount: number;
}

export interface DerivedSkuBudgetState {
  activeBudget: DerivedActiveSkuBudget;
  remainingPublishBudget: number | null;
  creditBudget: CreditBudget;
}

export interface PublishCapacityResult {
  used: number;
  limit: number | null;
  remaining: number | null;
  budgetKind: ActiveSkuBudgetKind | null;
}

export interface VariantGlobalCapResult {
  total: number;
  cap: number | null;
  remaining: number | null;
  utilization: number | null;
}

/**
 * Describes a publish-credit capacity violation for customer-facing mutations.
 */
export class PublishLimitExceededError extends Error {
  intendedPublishCount: number;
  used: number;
  limit: number;
  remaining: number;

  constructor(params: {
    intendedPublishCount: number;
    used: number;
    limit: number;
  }) {
    const remaining = Math.max(0, params.limit - params.used);
    super(
      `Publishing ${params.intendedPublishCount.toLocaleString("en-US")} passports would exceed your credit limit of ${params.limit.toLocaleString("en-US")}. You have ${remaining.toLocaleString("en-US")} credits remaining.`,
    );
    this.name = "PublishLimitExceededError";
    this.intendedPublishCount = params.intendedPublishCount;
    this.used = params.used;
    this.limit = params.limit;
    this.remaining = remaining;
  }
}

/**
 * Describes a global variant-cap violation for create-heavy background writes.
 */
export class VariantGlobalCapExceededError extends Error {
  intendedCreateCount: number;
  totalExistingVariants: number;
  cap: number;
  remaining: number;

  constructor(params: {
    intendedCreateCount: number;
    totalExistingVariants: number;
    cap: number;
  }) {
    const remaining = Math.max(0, params.cap - params.totalExistingVariants);
    super(
      `Creating ${params.intendedCreateCount.toLocaleString("en-US")} new variants would exceed the global variant cap of ${params.cap.toLocaleString("en-US")}. You have ${remaining.toLocaleString("en-US")} remaining.`,
    );
    this.name = "VariantGlobalCapExceededError";
    this.intendedCreateCount = params.intendedCreateCount;
    this.totalExistingVariants = params.totalExistingVariants;
    this.cap = params.cap;
    this.remaining = remaining;
  }
}

/**
 * Parses a database date or timestamp into a valid JavaScript Date.
 */
function parseDateLike(value: DateLike): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value.");
  }

  return parsed;
}

/**
 * Clamps a potentially invalid usage count to a safe non-negative integer.
 */
function sanitizeCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

/**
 * Clamps a potentially invalid credit or limit value to a safe non-negative integer.
 */
function sanitizeLimit(value: number | null | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(0, Math.trunc(value));
}

/**
 * Builds a normalized budget object from a raw limit and usage count.
 */
function createBudget(
  limit: number | null,
  used: number,
): DerivedSkuAccessBudget {
  if (limit === null) {
    return {
      limit: null,
      used,
      remaining: null,
      utilization: null,
    };
  }

  const remaining = Math.max(0, limit - used);

  return {
    limit,
    used,
    remaining,
    utilization: limit === 0 ? 1 : used / limit,
  };
}

/**
 * Counts the brand's live variant SKUs across the full catalog.
 */
export async function countBrandSkus(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
): Promise<number> {
  const [row] = await dbOrTx
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(products.brandId, brandId));

  return row?.count ?? 0;
}

/**
 * Counts the brand's published passports across the full catalog.
 */
export async function countPublishedPassports(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
): Promise<number> {
  const [row] = await dbOrTx
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(eq(products.brandId, brandId), eq(products.status, "published")),
    );

  return row?.count ?? 0;
}

/**
 * Reads the database server's current UTC timestamp for exact enforcement checks.
 */
export async function getCurrentDatabaseTimestamp(
  dbOrTx: DatabaseOrTransaction,
): Promise<Date> {
  const [row] = await dbOrTx.execute<{ current_timestamp: string }>(
    sql`SELECT NOW()::timestamptz::text AS current_timestamp`,
  );

  if (!row?.current_timestamp) {
    throw new Error("Failed to read the current database timestamp.");
  }

  return parseDateLike(row.current_timestamp);
}

/**
 * Reads the database server's current UTC date for legacy date-only callers.
 */
export async function getCurrentDatabaseDate(
  dbOrTx: DatabaseOrTransaction,
): Promise<Date> {
  const timestamp = await getCurrentDatabaseTimestamp(dbOrTx);

  return new Date(
    Date.UTC(
      timestamp.getUTCFullYear(),
      timestamp.getUTCMonth(),
      timestamp.getUTCDate(),
    ),
  );
}

/**
 * Derives the credit budgets from the current published count and total credits.
 */
export function deriveSkuBudget(params: {
  snapshot: Pick<BrandAccessSnapshotRow, "lifecycle" | "plan">;
  currentPublishUsageCount?: number;
  currentSkuUsageCount?: number;
  currentNonGhostSkuCount?: number;
  trialStartedAt?: DateLike | null;
  evaluationDate?: DateLike | null;
}): DerivedSkuBudgetState {
  const publishedCount = sanitizeCount(
    params.currentPublishUsageCount ??
      params.currentSkuUsageCount ??
      params.currentNonGhostSkuCount,
  );
  const totalCredits = sanitizeLimit(params.snapshot.plan?.totalCredits) ?? 0;
  const phase = params.snapshot.lifecycle?.phase ?? "none";
  const normalizedBudget = createBudget(totalCredits, publishedCount);
  const creditBudget: CreditBudget = {
    totalCredits,
    publishedCount,
    remaining: Math.max(0, totalCredits - publishedCount),
    utilization: totalCredits === 0 ? 1 : publishedCount / totalCredits,
  };

  return {
    activeBudget: {
      ...normalizedBudget,
      kind: "credits",
      phase,
      totalCredits,
      publishedCount,
    },
    remainingPublishBudget: normalizedBudget.remaining,
    creditBudget,
  };
}

/**
 * Locks the brand plan row so concurrent SKU create flows serialize on a single brand.
 */
export async function lockBrandPlanRowForSkuUsage(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
): Promise<void> {
  await dbOrTx.execute(
    sql`SELECT ${brandPlan.id} FROM ${brandPlan} WHERE ${brandPlan.brandId} = ${brandId} FOR UPDATE`,
  );
}

/**
 * Enforces publish capacity against the brand's cumulative credit balance.
 */
export async function enforcePublishCapacity(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
  intendedPublishCount: number,
): Promise<PublishCapacityResult> {
  const sanitizedIntendedPublishCount = sanitizeCount(intendedPublishCount);
  await lockBrandPlanRowForSkuUsage(dbOrTx, brandId);

  const [plan] = await dbOrTx
    .select({
      totalCredits: brandPlan.totalCredits,
    })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, brandId))
    .limit(1);
  const limit = sanitizeLimit(plan?.totalCredits) ?? 0;
  const used = await countPublishedPassports(dbOrTx, brandId);
  const remaining = Math.max(0, limit - used);

  if (used + sanitizedIntendedPublishCount > limit) {
    throw new PublishLimitExceededError({
      intendedPublishCount: sanitizedIntendedPublishCount,
      used,
      limit,
    });
  }

  return {
    used,
    limit,
    remaining,
    budgetKind: "credits",
  };
}

/**
 * Enforces the infrastructure-only global variant cap for create paths.
 */
export async function enforceVariantGlobalCap(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
  intendedCreateCount: number,
): Promise<VariantGlobalCapResult> {
  const sanitizedIntendedCreateCount = sanitizeCount(intendedCreateCount);
  await lockBrandPlanRowForSkuUsage(dbOrTx, brandId);

  const total = await countBrandSkus(dbOrTx, brandId);
  const [plan] = await dbOrTx
    .select({
      variantGlobalCap: brandPlan.variantGlobalCap,
    })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, brandId))
    .limit(1);

  const cap = sanitizeLimit(plan?.variantGlobalCap);
  const remaining = cap === null ? null : Math.max(0, cap - total);
  const utilization = cap === null ? null : cap === 0 ? 1 : total / cap;

  if (
    cap !== null &&
    sanitizedIntendedCreateCount > 0 &&
    total + sanitizedIntendedCreateCount > cap
  ) {
    throw new VariantGlobalCapExceededError({
      intendedCreateCount: sanitizedIntendedCreateCount,
      totalExistingVariants: total,
      cap,
    });
  }

  return {
    total,
    cap,
    remaining,
    utilization,
  };
}
