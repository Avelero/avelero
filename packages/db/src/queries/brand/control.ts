import { eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import {
  BRAND_BILLING_ACCESS_OVERRIDES,
  BRAND_BILLING_MODES,
  BRAND_BILLING_STATUSES,
  BRAND_OPERATIONAL_STATUSES,
  BRAND_PLAN_TYPES,
  BRAND_QUALIFICATION_STATUSES,
  brandControl,
} from "../../schema";

export {
  BRAND_BILLING_ACCESS_OVERRIDES,
  BRAND_BILLING_MODES,
  BRAND_BILLING_STATUSES,
  BRAND_OPERATIONAL_STATUSES,
  BRAND_PLAN_TYPES,
  BRAND_QUALIFICATION_STATUSES,
};

export type BrandControlRow = typeof brandControl.$inferSelect;
export type QualificationStatus = (typeof BRAND_QUALIFICATION_STATUSES)[number];
export type OperationalStatus = (typeof BRAND_OPERATIONAL_STATUSES)[number];
export type LocalBillingStatus = (typeof BRAND_BILLING_STATUSES)[number];
export type BillingMode = (typeof BRAND_BILLING_MODES)[number];
export type BillingAccessOverride =
  (typeof BRAND_BILLING_ACCESS_OVERRIDES)[number];
export type BrandPlanType = (typeof BRAND_PLAN_TYPES)[number];

export const DEFAULT_BRAND_CONTROL_VALUES = {
  qualificationStatus: "pending" as QualificationStatus,
  operationalStatus: "active" as OperationalStatus,
  billingStatus: "unconfigured" as LocalBillingStatus,
  billingMode: null as BillingMode | null,
  billingAccessOverride: "none" as BillingAccessOverride,
  planType: null as BrandPlanType | null,
  planCurrency: "EUR",
  customMonthlyPriceCents: null as number | null,
} as const;

type BrandControlPatch = Partial<
  Pick<
    typeof brandControl.$inferInsert,
    | "qualificationStatus"
    | "operationalStatus"
    | "billingStatus"
    | "billingMode"
    | "billingAccessOverride"
    | "planType"
    | "planCurrency"
    | "customMonthlyPriceCents"
  >
>;

export async function createDefaultBrandControl(
  db: DatabaseOrTransaction,
  brandId: string,
) {
  const [row] = await db
    .insert(brandControl)
    .values({
      brandId,
      ...DEFAULT_BRAND_CONTROL_VALUES,
    })
    .onConflictDoNothing()
    .returning();

  return row ?? null;
}

export async function getBrandControlByBrandId(
  db: DatabaseOrTransaction,
  brandId: string,
) {
  const [row] = await db
    .select()
    .from(brandControl)
    .where(eq(brandControl.brandId, brandId))
    .limit(1);

  return row ?? null;
}

export async function upsertBrandControl(
  db: DatabaseOrTransaction,
  input: { brandId: string } & BrandControlPatch,
) {
  await createDefaultBrandControl(db, input.brandId);

  const updateData: BrandControlPatch & { updatedAt?: string } = {};

  if (input.qualificationStatus !== undefined) {
    updateData.qualificationStatus = input.qualificationStatus;
  }
  if (input.operationalStatus !== undefined) {
    updateData.operationalStatus = input.operationalStatus;
  }
  if (input.billingStatus !== undefined) {
    updateData.billingStatus = input.billingStatus;
  }
  if (input.billingMode !== undefined) {
    updateData.billingMode = input.billingMode;
  }
  if (input.billingAccessOverride !== undefined) {
    updateData.billingAccessOverride = input.billingAccessOverride;
  }
  if (input.planType !== undefined) {
    updateData.planType = input.planType;
  }
  if (input.planCurrency !== undefined) {
    updateData.planCurrency = input.planCurrency;
  }
  if (input.customMonthlyPriceCents !== undefined) {
    updateData.customMonthlyPriceCents = input.customMonthlyPriceCents;
  }

  if (Object.keys(updateData).length > 0) {
    updateData.updatedAt = new Date().toISOString();

    const [row] = await db
      .update(brandControl)
      .set(updateData)
      .where(eq(brandControl.brandId, input.brandId))
      .returning();

    if (row) return row;
  }

  const row = await getBrandControlByBrandId(db, input.brandId);
  if (!row) {
    throw new Error("Failed to upsert brand control row");
  }

  return row;
}
