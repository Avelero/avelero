/**
 * Publish usage notification helpers.
 *
 * Centralizes post-commit publish-budget notifications so product save flows
 * and explicit publish actions share the same warning/reached logic.
 */

import type { Database } from "@v1/db/client";
import {
  countPublishedPassportsInActiveWindow,
  getBrandAccessSnapshot,
  getCurrentDatabaseTimestamp,
  resolveActiveSkuWindow,
} from "@v1/db/queries/brand";
import { publishNotificationEvent } from "@v1/db/queries/notifications";

const PUBLISH_NOTIFICATION_THRESHOLD = 0.9;

/**
 * Publishes a warning or reached notification after new published usage is committed.
 */
export async function notifyPublishUsageIfNeeded(params: {
  db: Database;
  brandId: string;
  usageDelta: number;
}): Promise<void> {
  const { db, brandId, usageDelta } = params;
  if (!Number.isFinite(usageDelta) || usageDelta <= 0) {
    return;
  }

  const evaluationDate = await getCurrentDatabaseTimestamp(db);
  const snapshot = await getBrandAccessSnapshot(db, brandId);
  const activeWindow = resolveActiveSkuWindow({
    snapshot,
    evaluationDate,
  });

  if (!activeWindow.kind || activeWindow.limit == null || activeWindow.limit === 0) {
    return;
  }

  const used = await countPublishedPassportsInActiveWindow(
    db,
    brandId,
    activeWindow,
  );

  if (used >= activeWindow.limit) {
    await publishNotificationEvent(db, {
      event: "sku_limit_reached",
      brandId,
      payload: {
        brandId,
        budgetKind: activeWindow.kind,
        used,
        limit: activeWindow.limit,
      },
    });
    return;
  }

  if (used / activeWindow.limit < PUBLISH_NOTIFICATION_THRESHOLD) {
    return;
  }

  await publishNotificationEvent(db, {
    event: "sku_limit_warning",
    brandId,
    payload: {
      brandId,
      budgetKind: activeWindow.kind,
      used,
      limit: activeWindow.limit,
    },
  });
}
