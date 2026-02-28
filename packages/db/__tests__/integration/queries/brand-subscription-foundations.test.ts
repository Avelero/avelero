import "../../setup";

import { describe, expect, it } from "bun:test";
import { and, eq, sql } from "drizzle-orm";
import { createBrand } from "@v1/db/queries/brand";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import { backfillBrandSubscriptionFoundations } from "../../../src/scripts/backfill-brand-subscription-foundations";

describe("Brand subscription foundations", () => {
  it("createBrand seeds lifecycle, plan, and billing defaults", async () => {
    const userId = await createTestUser("subscription-seed-owner@example.com");

    const created = await createBrand(testDb, userId, {
      name: "Subscription Seed Brand",
    });

    const brandId = created.id;

    const [lifecycle] = await testDb
      .select({
        brandId: schema.brandLifecycle.brandId,
        phase: schema.brandLifecycle.phase,
        phaseChangedAt: schema.brandLifecycle.phaseChangedAt,
        trialStartedAt: schema.brandLifecycle.trialStartedAt,
        trialEndsAt: schema.brandLifecycle.trialEndsAt,
      })
      .from(schema.brandLifecycle)
      .where(eq(schema.brandLifecycle.brandId, brandId))
      .limit(1);

    const [plan] = await testDb
      .select({
        brandId: schema.brandPlan.brandId,
        planType: schema.brandPlan.planType,
        skusCreatedThisYear: schema.brandPlan.skusCreatedThisYear,
        skusCreatedOnboarding: schema.brandPlan.skusCreatedOnboarding,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId))
      .limit(1);

    const [billing] = await testDb
      .select({
        brandId: schema.brandBilling.brandId,
        billingMode: schema.brandBilling.billingMode,
        planCurrency: schema.brandBilling.planCurrency,
        billingAccessOverride: schema.brandBilling.billingAccessOverride,
      })
      .from(schema.brandBilling)
      .where(eq(schema.brandBilling.brandId, brandId))
      .limit(1);

    expect(lifecycle).toBeDefined();
    expect(lifecycle?.phase).toBe("demo");
    expect(lifecycle?.phaseChangedAt).toBeDefined();
    expect(lifecycle?.trialStartedAt).toBeNull();
    expect(lifecycle?.trialEndsAt).toBeNull();

    expect(plan).toBeDefined();
    expect(plan?.planType).toBeNull();
    expect(plan?.skusCreatedThisYear).toBe(0);
    expect(plan?.skusCreatedOnboarding).toBe(0);

    expect(billing).toBeDefined();
    expect(billing?.billingMode).toBeNull();
    expect(billing?.planCurrency).toBe("EUR");
    expect(billing?.billingAccessOverride).toBe("none");
  });

  it("backfills missing 1:1 rows and is idempotent", async () => {
    const legacyBrandId = await createTestBrand("Legacy Backfill Brand");

    const firstRun = await backfillBrandSubscriptionFoundations(testDb);

    expect(firstRun.inserted.lifecycle).toBeGreaterThanOrEqual(1);
    expect(firstRun.inserted.plan).toBeGreaterThanOrEqual(1);
    expect(firstRun.inserted.billing).toBeGreaterThanOrEqual(1);

    const [lifecycle] = await testDb
      .select({ id: schema.brandLifecycle.id, phase: schema.brandLifecycle.phase })
      .from(schema.brandLifecycle)
      .where(eq(schema.brandLifecycle.brandId, legacyBrandId))
      .limit(1);
    const [plan] = await testDb
      .select({
        id: schema.brandPlan.id,
        skusCreatedThisYear: schema.brandPlan.skusCreatedThisYear,
        skusCreatedOnboarding: schema.brandPlan.skusCreatedOnboarding,
      })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, legacyBrandId))
      .limit(1);
    const [billing] = await testDb
      .select({
        id: schema.brandBilling.id,
        planCurrency: schema.brandBilling.planCurrency,
        billingAccessOverride: schema.brandBilling.billingAccessOverride,
      })
      .from(schema.brandBilling)
      .where(eq(schema.brandBilling.brandId, legacyBrandId))
      .limit(1);

    expect(lifecycle?.id).toBeDefined();
    expect(lifecycle?.phase).toBe("demo");
    expect(plan?.id).toBeDefined();
    expect(plan?.skusCreatedThisYear).toBe(0);
    expect(plan?.skusCreatedOnboarding).toBe(0);
    expect(billing?.id).toBeDefined();
    expect(billing?.planCurrency).toBe("EUR");
    expect(billing?.billingAccessOverride).toBe("none");

    const secondRun = await backfillBrandSubscriptionFoundations(testDb);
    expect(secondRun.inserted.lifecycle).toBe(0);
    expect(secondRun.inserted.plan).toBe(0);
    expect(secondRun.inserted.billing).toBe(0);
    expect(secondRun.after.lifecycleMissing).toBe(0);
    expect(secondRun.after.planMissing).toBe(0);
    expect(secondRun.after.billingMissing).toBe(0);
  });

  it("enforces phase check constraint on brand_lifecycle", async () => {
    const brandId = await createTestBrand("Constraint Lifecycle Brand");

    let error: Error | null = null;
    try {
      await testDb.insert(schema.brandLifecycle).values({
        brandId,
        phase: "invalid_phase",
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23514");
    expect(pgError?.constraint_name).toBe("brand_lifecycle_phase_check");
  });

  it("enforces non-negative counter constraint on brand_plan", async () => {
    const brandId = await createTestBrand("Constraint Plan Brand");

    let error: Error | null = null;
    try {
      await testDb.insert(schema.brandPlan).values({
        brandId,
        skusCreatedThisYear: -1,
        skusCreatedOnboarding: 0,
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23514");
    expect(pgError?.constraint_name).toBe(
      "brand_plan_skus_created_this_year_check",
    );
  });

  it("enforces billing override constraint on brand_billing", async () => {
    const brandId = await createTestBrand("Constraint Billing Brand");

    let error: Error | null = null;
    try {
      await testDb.insert(schema.brandBilling).values({
        brandId,
        billingAccessOverride: "forever_allow",
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23514");
    expect(pgError?.constraint_name).toBe("brand_billing_access_override_check");
  });

  it("enforces unique stripe event id for webhook idempotency", async () => {
    const stripeEventId = `evt_test_${Math.random().toString(36).slice(2, 10)}`;

    await testDb.insert(schema.stripeWebhookEvents).values({
      stripeEventId,
      eventType: "checkout.session.completed",
    });

    let error: Error | null = null;
    try {
      await testDb.insert(schema.stripeWebhookEvents).values({
        stripeEventId,
        eventType: "checkout.session.completed",
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23505");
    expect(pgError?.constraint_name).toBe(
      "stripe_webhook_events_stripe_event_id_unq",
    );
  });

  it("enforces one lifecycle row per brand", async () => {
    const brandId = await createTestBrand("Lifecycle 1-1 Brand");

    await testDb.insert(schema.brandLifecycle).values({
      brandId,
      phase: "demo",
    });

    let error: Error | null = null;
    try {
      await testDb.insert(schema.brandLifecycle).values({
        brandId,
        phase: "trial",
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error).not.toBeNull();
    const pgError = (error as any)?.cause;
    expect(pgError?.code).toBe("23505");
    expect(pgError?.constraint_name).toBe("brand_lifecycle_brand_id_unq");
  });

  it("cascades deletes from brands to new brand-scoped tables", async () => {
    const userId = await createTestUser("cascade-check-owner@example.com");
    const created = await createBrand(testDb, userId, { name: "Cascade Brand" });

    const brandId = created.id;
    await testDb.delete(schema.brands).where(eq(schema.brands.id, brandId));

    const [lifecycleCount] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandLifecycle)
      .where(eq(schema.brandLifecycle.brandId, brandId));
    const [planCount] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandPlan)
      .where(eq(schema.brandPlan.brandId, brandId));
    const [billingCount] = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandBilling)
      .where(eq(schema.brandBilling.brandId, brandId));

    expect(lifecycleCount?.count).toBe(0);
    expect(planCount?.count).toBe(0);
    expect(billingCount?.count).toBe(0);
  });

  it("keeps existing createBrand side effects unchanged", async () => {
    const userId = await createTestUser("unchanged-side-effects@example.com");
    const created = await createBrand(testDb, userId, {
      name: "Unchanged Side Effects Brand",
    });

    const brandId = created.id;

    const [theme] = await testDb
      .select({ brandId: schema.brandTheme.brandId })
      .from(schema.brandTheme)
      .where(eq(schema.brandTheme.brandId, brandId))
      .limit(1);

    const [membership] = await testDb
      .select({ id: schema.brandMembers.id })
      .from(schema.brandMembers)
      .where(
        and(
          eq(schema.brandMembers.brandId, brandId),
          eq(schema.brandMembers.userId, userId),
          eq(schema.brandMembers.role, "owner"),
        ),
      )
      .limit(1);

    const [user] = await testDb
      .select({ brandId: schema.users.brandId })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    expect(theme?.brandId).toBe(brandId);
    expect(membership?.id).toBeDefined();
    expect(user?.brandId).toBe(brandId);
  });
});
