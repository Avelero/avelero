/**
 * Publish usage notification helpers.
 *
 * Centralizes post-commit publish-budget notifications so product save flows
 * and explicit publish actions share the same warning/reached logic.
 */

import type { Database } from "@v1/db/client";
import { brandPlan } from "@v1/db/schema";
import { eq } from "drizzle-orm";
import { publishNotificationEvent } from "@v1/db/queries/notifications";

const PUBLISH_NOTIFICATION_THRESHOLD = 0.9;

/**
 * Publishes a warning or reached notification after new published usage is committed.
 */
export async function notifyPublishUsageIfNeeded(params: {
  db: Database;
  brandId: string;
  previousUsed: number;
  used: number;
}): Promise<void> {
  const { db, brandId, previousUsed, used } = params;

  if (
    !Number.isFinite(previousUsed) ||
    !Number.isFinite(used) ||
    previousUsed < 0 ||
    used <= previousUsed
  ) {
    return;
  }

  const [plan] = await db
    .select({ totalCredits: brandPlan.totalCredits })
    .from(brandPlan)
    .where(eq(brandPlan.brandId, brandId))
    .limit(1);

  if (!plan || plan.totalCredits <= 0) {
    return;
  }

  const limit = plan.totalCredits;

  if (previousUsed < limit && used >= limit) {
    await publishNotificationEvent(db, {
      event: "credit_limit_reached",
      brandId,
      payload: {
        brandId,
        used,
        limit,
      },
    });
    return;
  }

  if (
    previousUsed / limit < PUBLISH_NOTIFICATION_THRESHOLD &&
    used / limit >= PUBLISH_NOTIFICATION_THRESHOLD
  ) {
    await publishNotificationEvent(db, {
      event: "credit_limit_warning",
      brandId,
      payload: {
        brandId,
        used,
        limit,
      },
    });
  }
}
