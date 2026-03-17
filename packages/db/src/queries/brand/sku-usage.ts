/**
 * Brand SKU usage queries and lazy SKU period maintenance helpers.
 */
import { and, eq, isNotNull, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { brandPlan, productVariants, products } from "../../schema";
import type { BrandAccessSnapshotRow } from "./access";

type DateLike = Date | string;

export const TRIAL_UNIVERSAL_CAP = 50_000;

export interface DerivedSkuAccessBudget {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

export interface DerivedSkuBudgetState {
  annual: DerivedSkuAccessBudget;
  onboarding: DerivedSkuAccessBudget;
  trial: DerivedSkuAccessBudget | null;
  remainingCreateBudget: number | null;
}

/**
 * Parses a database date or timestamp into a valid JavaScript Date.
 */
function parseDateLike(value: DateLike): Date {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error("Invalid date value.");
    }
    return new Date(value.getTime());
  }

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid date value.");
  }

  return parsed;
}

/**
 * Normalizes a Date to the start of its UTC day.
 */
function startOfUtcDay(value: Date): Date {
  return new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );
}

/**
 * Adds whole UTC years to a Date while preserving smaller time parts.
 */
function addUtcYears(value: Date, years: number): Date {
  return new Date(
    Date.UTC(
      value.getUTCFullYear() + years,
      value.getUTCMonth(),
      value.getUTCDate(),
      value.getUTCHours(),
      value.getUTCMinutes(),
      value.getUTCSeconds(),
      value.getUTCMilliseconds(),
    ),
  );
}

/**
 * Reads the database server's current date for date-only period comparisons.
 */
export async function getCurrentDatabaseDate(
  dbOrTx: DatabaseOrTransaction,
): Promise<Date> {
  const [row] = await dbOrTx.execute<{ current_date: string }>(
    sql`SELECT CURRENT_DATE::text AS current_date`,
  );

  if (!row?.current_date) {
    throw new Error("Failed to read the current database date.");
  }

  return startOfUtcDay(parseDateLike(row.current_date));
}

/**
 * Clamps a potentially invalid SKU count to a safe non-negative integer.
 */
function sanitizeCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

/**
 * Clamps a potentially invalid SKU limit to a safe non-negative integer.
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
 * Returns the smallest defined budget value, or null when all values are open.
 */
function minDefined(values: Array<number | null>): number | null {
  const defined = values.filter((value): value is number => value !== null);
  if (defined.length === 0) {
    return null;
  }

  return Math.min(...defined);
}

/**
 * Counts the brand's live variant SKUs, including legacy ghost-marked rows.
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
    .where(and(eq(products.brandId, brandId)));

  return row?.count ?? 0;
}

export const countNonGhostSkus = countBrandSkus;

/**
 * Derives SKU usage budgets from live variant counts and stored snapshots.
 */
export function deriveSkuBudget(params: {
  snapshot: Pick<BrandAccessSnapshotRow, "lifecycle" | "plan">;
  currentNonGhostSkuCount: number;
  trialStartedAt: Date | string | null;
  evaluationDate?: DateLike | null;
}): DerivedSkuBudgetState {
  const currentNonGhostSkuCount = sanitizeCount(params.currentNonGhostSkuCount);
  const plan = params.snapshot.plan;
  const hasAnnualSnapshot = plan?.skuCountAtYearStart != null;
  const hasOnboardingSnapshot = plan?.skuCountAtOnboardingStart != null;

  const annualLimit = hasAnnualSnapshot
    ? sanitizeLimit(plan?.skuLimitOverride ?? plan?.skuAnnualLimit)
    : null;
  const annualUsed = hasAnnualSnapshot
    ? Math.max(
        0,
        currentNonGhostSkuCount - sanitizeCount(plan?.skuCountAtYearStart),
      )
    : 0;

  const onboardingLimit =
    hasOnboardingSnapshot &&
    isOnboardingYear(params.trialStartedAt, params.evaluationDate)
      ? sanitizeLimit(plan?.skuOnboardingLimit)
      : null;
  const onboardingUsed =
    hasOnboardingSnapshot && onboardingLimit !== null
      ? Math.max(
          0,
          currentNonGhostSkuCount -
            sanitizeCount(plan?.skuCountAtOnboardingStart),
        )
      : 0;

  const annual = createBudget(annualLimit, annualUsed);
  const onboarding = createBudget(onboardingLimit, onboardingUsed);
  const trial =
    params.snapshot.lifecycle?.phase === "trial"
      ? createBudget(TRIAL_UNIVERSAL_CAP, currentNonGhostSkuCount)
      : null;

  return {
    annual,
    onboarding,
    trial,
    remainingCreateBudget: minDefined([
      annual.remaining,
      onboarding.remaining,
      trial?.remaining ?? null,
    ]),
  };
}

/**
 * Advances the annual SKU period when the brand has passed its anniversary.
 */
export async function lazyResetAnnualPeriodIfNeeded(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
  evaluationDate?: DateLike | null,
): Promise<{ wasReset: boolean }> {
  const [planRow] = await dbOrTx
    .select({
      skuYearStart: brandPlan.skuYearStart,
    })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, brandId))
    .limit(1);

  if (!planRow?.skuYearStart) {
    return { wasReset: false };
  }

  const currentDate = evaluationDate
    ? startOfUtcDay(parseDateLike(evaluationDate))
    : await getCurrentDatabaseDate(dbOrTx);
  const currentYearStart = startOfUtcDay(parseDateLike(planRow.skuYearStart));
  const firstAnniversary = addUtcYears(currentYearStart, 1);

  if (currentDate < firstAnniversary) {
    return { wasReset: false };
  }

  const currentNonGhostSkuCount = await countBrandSkus(dbOrTx, brandId);

  let nextYearStart = currentYearStart;
  while (currentDate >= addUtcYears(nextYearStart, 1)) {
    nextYearStart = addUtcYears(nextYearStart, 1);
  }

  const [updatedRow] = await dbOrTx
    .update(brandPlan)
    .set({
      skuCountAtYearStart: currentNonGhostSkuCount,
      skuYearStart: nextYearStart,
    })
    .where(eq(brandPlan.brandId, brandId))
    .returning({ id: brandPlan.id });

  return { wasReset: Boolean(updatedRow) };
}

/**
 * Expires the onboarding SKU limit once the first trial year has ended.
 */
export async function lazyExpireOnboardingLimitIfNeeded(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
  trialStartedAt: Date | string | null,
  evaluationDate?: DateLike | null,
): Promise<{ wasExpired: boolean }> {
  if (!trialStartedAt || isOnboardingYear(trialStartedAt, evaluationDate)) {
    return { wasExpired: false };
  }

  const [updatedRow] = await dbOrTx
    .update(brandPlan)
    .set({
      skuOnboardingLimit: null,
    })
    .where(
      and(
        eq(brandPlan.brandId, brandId),
        isNotNull(brandPlan.skuOnboardingLimit),
      ),
    )
    .returning({ id: brandPlan.id });

  return { wasExpired: Boolean(updatedRow) };
}

/**
 * Determines whether a brand is still within its onboarding year.
 */
export function isOnboardingYear(
  trialStartedAt: Date | string | null,
  evaluationDate?: DateLike | null,
): boolean {
  if (!trialStartedAt) {
    return false;
  }

  const onboardingEndsAt = addUtcYears(parseDateLike(trialStartedAt), 1);
  const currentDate = evaluationDate ? parseDateLike(evaluationDate) : new Date();
  return currentDate.getTime() < onboardingEndsAt.getTime();
}
