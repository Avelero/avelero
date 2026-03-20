/**
 * Brand SKU usage queries, active-window derivation, and paid anchor helpers.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import { brandPlan, productVariants, products } from "../../schema";
import type { BrandAccessSnapshotRow } from "./access";

type DateLike = Date | string;

export const TRIAL_SKU_CAP = 50;
export const TRIAL_UNIVERSAL_CAP = TRIAL_SKU_CAP;

export type ActiveSkuBudgetKind = "trial" | "onboarding" | "annual";
export type ActiveSkuPhase = "demo" | "trial" | "onboarding" | "annual" | "none";

export interface DerivedSkuAccessBudget {
  limit: number | null;
  used: number;
  remaining: number | null;
  utilization: number | null;
}

export interface ResolvedActiveSkuWindow {
  phase: ActiveSkuPhase;
  kind: ActiveSkuBudgetKind | null;
  limit: number | null;
  windowStartAt: string | null;
  windowEndAt: string | null;
  isFirstPaidYear: boolean;
}

export interface DerivedActiveSkuBudget extends DerivedSkuAccessBudget {
  kind: ActiveSkuBudgetKind | null;
  phase: ActiveSkuPhase;
  windowStartAt: string | null;
  windowEndAt: string | null;
  isFirstPaidYear: boolean;
}

export interface DerivedSkuBudgetState {
  activeBudget: DerivedActiveSkuBudget;
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
 * Clamps a potentially invalid SKU usage count to a safe non-negative integer.
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
 * Builds the active budget payload from a resolved window and usage count.
 */
function createActiveBudget(
  window: ResolvedActiveSkuWindow,
  used: number,
): DerivedActiveSkuBudget {
  const normalizedBudget = createBudget(window.limit, used);

  return {
    ...normalizedBudget,
    kind: window.kind,
    phase: window.phase,
    windowStartAt: window.windowStartAt,
    windowEndAt: window.windowEndAt,
    isFirstPaidYear: window.isFirstPaidYear,
  };
}

/**
 * Derives the annual entitlement window that contains the provided timestamp.
 */
export function deriveAnnualWindowAt(params: {
  annualUsageAnchorAt: DateLike;
  evaluationDate?: DateLike | null;
}): {
  windowStartAt: Date;
  windowEndAt: Date;
} {
  const evaluationAt = params.evaluationDate
    ? parseDateLike(params.evaluationDate)
    : new Date();
  let windowStartAt = parseDateLike(params.annualUsageAnchorAt);
  let windowEndAt = addUtcYears(windowStartAt, 1);

  // Advance by full anniversaries until the evaluation timestamp fits the current year.
  while (evaluationAt.getTime() >= windowEndAt.getTime()) {
    windowStartAt = windowEndAt;
    windowEndAt = addUtcYears(windowStartAt, 1);
  }

  return { windowStartAt, windowEndAt };
}

/**
 * Resolves the single active SKU window for the brand at the evaluation time.
 */
export function resolveActiveSkuWindow(params: {
  snapshot: Pick<BrandAccessSnapshotRow, "lifecycle" | "plan">;
  evaluationDate?: DateLike | null;
}): ResolvedActiveSkuWindow {
  const lifecycle = params.snapshot.lifecycle;
  const plan = params.snapshot.plan;
  const evaluationAt = params.evaluationDate
    ? parseDateLike(params.evaluationDate)
    : new Date();

  if (lifecycle?.phase === "demo") {
    return {
      phase: "demo",
      kind: null,
      limit: null,
      windowStartAt: null,
      windowEndAt: null,
      isFirstPaidYear: false,
    };
  }

  if (lifecycle?.phase === "trial") {
    return {
      phase: "trial",
      kind: "trial",
      limit: TRIAL_SKU_CAP,
      windowStartAt: lifecycle.trialStartedAt,
      windowEndAt: plan?.firstPaidStartedAt ?? lifecycle.trialEndsAt ?? null,
      isFirstPaidYear: false,
    };
  }

  if (plan?.firstPaidStartedAt) {
    const onboardingStartAt = parseDateLike(plan.firstPaidStartedAt);
    const onboardingEndAt = addUtcYears(onboardingStartAt, 1);

    if (evaluationAt.getTime() < onboardingEndAt.getTime()) {
      return {
        phase: "onboarding",
        kind: "onboarding",
        limit: sanitizeLimit(plan.skuOnboardingLimit),
        windowStartAt: onboardingStartAt.toISOString(),
        windowEndAt: onboardingEndAt.toISOString(),
        isFirstPaidYear: true,
      };
    }
  }

  if (plan?.annualUsageAnchorAt) {
    const annualWindow = deriveAnnualWindowAt({
      annualUsageAnchorAt: plan.annualUsageAnchorAt,
      evaluationDate: evaluationAt,
    });

    return {
      phase: "annual",
      kind: "annual",
      limit: sanitizeLimit(plan.skuLimitOverride ?? plan.skuAnnualLimit),
      windowStartAt: annualWindow.windowStartAt.toISOString(),
      windowEndAt: annualWindow.windowEndAt.toISOString(),
      isFirstPaidYear: false,
    };
  }

  return {
    phase: "none",
    kind: null,
    limit: null,
    windowStartAt: null,
    windowEndAt: null,
    isFirstPaidYear: false,
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

export const countNonGhostSkus = countBrandSkus;

/**
 * Counts the brand's existing variants that were created inside the active SKU window.
 */
export async function countBrandSkusInActiveWindow(
  dbOrTx: DatabaseOrTransaction,
  brandId: string,
  window: ResolvedActiveSkuWindow,
): Promise<number> {
  if (!window.kind || !window.windowStartAt) {
    return 0;
  }

  const windowPredicate = window.windowEndAt
    ? sql`${productVariants.createdAt} >= ${window.windowStartAt} AND ${productVariants.createdAt} < ${window.windowEndAt}`
    : sql`${productVariants.createdAt} >= ${window.windowStartAt}`;

  const [row] = await dbOrTx
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(products.brandId, brandId), windowPredicate));

  return row?.count ?? 0;
}

/**
 * Reads the database server's current UTC timestamp for exact SKU window boundaries.
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
  return startOfUtcDay(await getCurrentDatabaseTimestamp(dbOrTx));
}

/**
 * Derives the SKU budgets from the resolved active window and counted live usage.
 */
export function deriveSkuBudget(params: {
  snapshot: Pick<BrandAccessSnapshotRow, "lifecycle" | "plan">;
  currentSkuUsageCount?: number;
  currentNonGhostSkuCount?: number;
  trialStartedAt?: DateLike | null;
  evaluationDate?: DateLike | null;
}): DerivedSkuBudgetState {
  const usageCount = sanitizeCount(
    params.currentSkuUsageCount ?? params.currentNonGhostSkuCount,
  );
  const activeWindow = resolveActiveSkuWindow({
    snapshot: params.snapshot,
    evaluationDate: params.evaluationDate,
  });
  const activeBudget = createActiveBudget(activeWindow, usageCount);
  const annual =
    activeWindow.kind === "annual"
      ? createBudget(activeWindow.limit, usageCount)
      : createBudget(null, 0);
  const onboarding =
    activeWindow.kind === "onboarding"
      ? createBudget(activeWindow.limit, usageCount)
      : createBudget(null, 0);
  const trial =
    activeWindow.kind === "trial"
      ? createBudget(activeWindow.limit, usageCount)
      : null;

  return {
    activeBudget,
    annual,
    onboarding,
    trial,
    remainingCreateBudget: activeBudget.remaining,
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
 * Computes the annual window that contained the brand's last entitled moment.
 */
function derivePriorEntitlementAnnualWindow(params: {
  annualUsageAnchorAt: DateLike;
  previousEntitlementEndedAt: DateLike;
}): {
  windowStartAt: Date;
  windowEndAt: Date;
} {
  const entitlementEndAt = parseDateLike(params.previousEntitlementEndedAt);
  const lastEntitledMoment = new Date(
    Math.max(0, entitlementEndAt.getTime() - 1),
  );

  return deriveAnnualWindowAt({
    annualUsageAnchorAt: params.annualUsageAnchorAt,
    evaluationDate: lastEntitledMoment,
  });
}

/**
 * Applies the paid SKU anchors when a brand first activates or resumes paid access.
 */
export async function syncBrandPaidSkuAnchors(opts: {
  dbOrTx: DatabaseOrTransaction;
  brandId: string;
  paidEntitlementStartsAt: DateLike;
  allowAnnualAnchorRealignment: boolean;
  previousEntitlementEndedAt?: DateLike | null;
}): Promise<void> {
  const { dbOrTx, brandId, allowAnnualAnchorRealignment } = opts;
  const paidEntitlementStartsAt = parseDateLike(
    opts.paidEntitlementStartsAt,
  ).toISOString();

  const [currentRow] = await dbOrTx
    .select({
      firstPaidStartedAt: brandPlan.firstPaidStartedAt,
      annualUsageAnchorAt: brandPlan.annualUsageAnchorAt,
    })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, brandId))
    .limit(1);

  if (!currentRow) {
    throw new Error("Brand plan row not found while syncing SKU anchors.");
  }

  const updates: Partial<{
    firstPaidStartedAt: string;
    annualUsageAnchorAt: string;
    updatedAt: string;
  }> = {};

  if (!currentRow.firstPaidStartedAt) {
    updates.firstPaidStartedAt = paidEntitlementStartsAt;
  }

  if (!currentRow.annualUsageAnchorAt) {
    updates.annualUsageAnchorAt = paidEntitlementStartsAt;
  } else if (
    allowAnnualAnchorRealignment &&
    (opts.previousEntitlementEndedAt ?? null)
  ) {
    const priorAnnualWindow = derivePriorEntitlementAnnualWindow({
      annualUsageAnchorAt: currentRow.annualUsageAnchorAt,
      previousEntitlementEndedAt: opts.previousEntitlementEndedAt!,
    });

    if (
      parseDateLike(paidEntitlementStartsAt).getTime() >=
      priorAnnualWindow.windowEndAt.getTime()
    ) {
      updates.annualUsageAnchorAt = paidEntitlementStartsAt;
    }
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  updates.updatedAt = new Date().toISOString();

  await dbOrTx
    .update(brandPlan)
    .set(updates)
    .where(eq(brandPlan.brandId, brandId));
}

/**
 * Determines whether a timestamp still falls inside the first paid year.
 */
export function isOnboardingYear(
  firstPaidStartedAt: Date | string | null,
  evaluationDate?: DateLike | null,
): boolean {
  if (!firstPaidStartedAt) {
    return false;
  }

  const onboardingEndsAt = addUtcYears(parseDateLike(firstPaidStartedAt), 1);
  const currentDate = evaluationDate ? parseDateLike(evaluationDate) : new Date();
  return currentDate.getTime() < onboardingEndsAt.getTime();
}

/**
 * Preserves the old annual reset hook signature while rollover is now derived from timestamps.
 */
export async function lazyResetAnnualPeriodIfNeeded(
  _dbOrTx?: DatabaseOrTransaction,
  _brandId?: string,
  _evaluationDate?: DateLike | null,
): Promise<{
  wasReset: boolean;
}> {
  return { wasReset: false };
}

/**
 * Preserves the old onboarding expiry hook signature while onboarding is now derived from anchors.
 */
export async function lazyExpireOnboardingLimitIfNeeded(
  _dbOrTx?: DatabaseOrTransaction,
  _brandId?: string,
  _firstPaidStartedAt?: DateLike | null,
  _evaluationDate?: DateLike | null,
): Promise<{
  wasExpired: boolean;
}> {
  return { wasExpired: false };
}
