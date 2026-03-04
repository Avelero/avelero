import { eq, isNull, sql } from "drizzle-orm";
import type { Database } from "../client";
import { serviceDb } from "../client";
import { brandBilling, brandLifecycle, brandPlan, brands } from "../schema";

type CountReadableDb = Pick<Database, "select">;

export type SubscriptionBackfillSummary = {
  before: {
    lifecycleMissing: number;
    planMissing: number;
    billingMissing: number;
  };
  inserted: {
    lifecycle: number;
    plan: number;
    billing: number;
  };
  after: {
    lifecycleMissing: number;
    planMissing: number;
    billingMissing: number;
  };
};

async function countMissingRows(db: CountReadableDb): Promise<{
  lifecycleMissing: number;
  planMissing: number;
  billingMissing: number;
}> {
  const [lifecycleRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(brands)
    .leftJoin(brandLifecycle, eq(brands.id, brandLifecycle.brandId))
    .where(isNull(brandLifecycle.id));

  const [planRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(brands)
    .leftJoin(brandPlan, eq(brands.id, brandPlan.brandId))
    .where(isNull(brandPlan.id));

  const [billingRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(brands)
    .leftJoin(brandBilling, eq(brands.id, brandBilling.brandId))
    .where(isNull(brandBilling.id));

  return {
    lifecycleMissing: lifecycleRow?.count ?? 0,
    planMissing: planRow?.count ?? 0,
    billingMissing: billingRow?.count ?? 0,
  };
}

export async function backfillBrandSubscriptionFoundations(
  db: Database = serviceDb,
): Promise<SubscriptionBackfillSummary> {
  return db.transaction(async (tx) => {
    const before = await countMissingRows(tx);

    await tx.execute(sql`
      INSERT INTO brand_lifecycle (
        brand_id,
        phase,
        phase_changed_at
      )
      SELECT
        b.id,
        'demo'::text,
        now()
      FROM brands b
      LEFT JOIN brand_lifecycle bl
        ON bl.brand_id = b.id
      WHERE bl.id IS NULL
      ON CONFLICT (brand_id) DO NOTHING
    `);

    await tx.execute(sql`
      INSERT INTO brand_plan (
        brand_id,
        skus_created_this_year,
        skus_created_onboarding
      )
      SELECT
        b.id,
        0,
        0
      FROM brands b
      LEFT JOIN brand_plan bp
        ON bp.brand_id = b.id
      WHERE bp.id IS NULL
      ON CONFLICT (brand_id) DO NOTHING
    `);

    await tx.execute(sql`
      INSERT INTO brand_billing (
        brand_id,
        plan_currency,
        billing_access_override
      )
      SELECT
        b.id,
        'EUR'::text,
        'none'::text
      FROM brands b
      LEFT JOIN brand_billing bb
        ON bb.brand_id = b.id
      WHERE bb.id IS NULL
      ON CONFLICT (brand_id) DO NOTHING
    `);

    const after = await countMissingRows(tx);

    return {
      before,
      inserted: {
        lifecycle: before.lifecycleMissing - after.lifecycleMissing,
        plan: before.planMissing - after.planMissing,
        billing: before.billingMissing - after.billingMissing,
      },
      after,
    };
  });
}

async function main() {
  const summary = await backfillBrandSubscriptionFoundations();
  console.log("Subscription foundations backfill complete");
  console.log(JSON.stringify(summary, null, 2));
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Subscription foundations backfill failed");
    console.error(error);
    process.exit(1);
  });
}
