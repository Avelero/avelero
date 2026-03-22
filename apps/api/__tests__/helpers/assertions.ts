/**
 * Database state assertion helpers for billing tests.
 */
import { expect } from "bun:test";
import { and, desc, eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";
import { testDb } from "@v1/db/testing";

/**
 * Asserts the current lifecycle phase for a brand.
 */
export async function assertPhase(brandId: string, expectedPhase: string) {
  const [lifecycle] = await testDb
    .select({ phase: schema.brandLifecycle.phase })
    .from(schema.brandLifecycle)
    .where(eq(schema.brandLifecycle.brandId, brandId))
    .limit(1);

  expect(lifecycle).toBeDefined();
  expect(lifecycle!.phase).toBe(expectedPhase);
}

/**
 * Asserts a partial match on the brand billing state.
 */
export async function assertBillingState(
  brandId: string,
  expectations: Partial<{
    billingMode: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    pastDueSince: string | null;
    pendingCancellation: boolean;
  }>,
) {
  const [billing] = await testDb
    .select({
      billingMode: schema.brandBilling.billingMode,
      stripeCustomerId: schema.brandBilling.stripeCustomerId,
      stripeSubscriptionId: schema.brandBilling.stripeSubscriptionId,
      currentPeriodStart: schema.brandBilling.currentPeriodStart,
      currentPeriodEnd: schema.brandBilling.currentPeriodEnd,
      pastDueSince: schema.brandBilling.pastDueSince,
      pendingCancellation: schema.brandBilling.pendingCancellation,
    })
    .from(schema.brandBilling)
    .where(eq(schema.brandBilling.brandId, brandId))
    .limit(1);

  expect(billing).toBeDefined();
  for (const [key, value] of Object.entries(expectations)) {
    if (value === null) {
      expect((billing as any)[key]).toBeNull();
    } else {
      expect((billing as any)[key]).toBe(value);
    }
  }
}

/**
 * Asserts a partial match on the brand plan state.
 */
export async function assertPlanState(
  brandId: string,
  expectations: Partial<{
    planType: string | null;
    billingInterval: string | null;
    hasImpactPredictions: boolean;
    totalCredits: number;
    onboardingDiscountUsed: boolean;
    variantGlobalCap: number | null;
  }>,
) {
  const [plan] = await testDb
    .select({
      planType: schema.brandPlan.planType,
      billingInterval: schema.brandPlan.billingInterval,
      hasImpactPredictions: schema.brandPlan.hasImpactPredictions,
      totalCredits: schema.brandPlan.totalCredits,
      onboardingDiscountUsed: schema.brandPlan.onboardingDiscountUsed,
      variantGlobalCap: schema.brandPlan.variantGlobalCap,
    })
    .from(schema.brandPlan)
    .where(eq(schema.brandPlan.brandId, brandId))
    .limit(1);

  expect(plan).toBeDefined();
  for (const [key, value] of Object.entries(expectations)) {
    if (value === null) {
      expect((plan as any)[key]).toBeNull();
    } else {
      expect((plan as any)[key]).toBe(value);
    }
  }
}

/**
 * Asserts that a billing event was recorded with the expected type.
 */
export async function assertBillingEventRecorded(
  brandId: string,
  eventType: string,
) {
  const [event] = await testDb
    .select({
      eventType: schema.brandBillingEvents.eventType,
      brandId: schema.brandBillingEvents.brandId,
    })
    .from(schema.brandBillingEvents)
    .where(
      and(
        eq(schema.brandBillingEvents.brandId, brandId),
        eq(schema.brandBillingEvents.eventType, eventType),
      ),
    )
    .orderBy(desc(schema.brandBillingEvents.createdAt))
    .limit(1);

  expect(event).toBeDefined();
  expect(event!.eventType).toBe(eventType);
}
