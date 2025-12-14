/**
 * Integration Sync Scheduler
 *
 * Scheduled task that checks for integrations due for sync and triggers them.
 * Runs hourly to check all brand integrations.
 *
 * @see plan-integration.md Phase 4 for architecture details
 */

import "./configure-trigger";
import { logger, schedules } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import { and, eq, isNull, or, sql } from "@v1/db/index";
import { brandIntegrations, integrations } from "@v1/db/schema";
import { syncIntegration } from "./integration-sync";

// =============================================================================
// TASK
// =============================================================================

export const integrationSyncScheduler = schedules.task({
  id: "integration-sync-scheduler",
  // Run every hour at minute 0
  cron: "0 * * * *",
  run: async () => {
    logger.info("Starting integration sync scheduler");

    const now = new Date();

    // Find integrations that are:
    // 1. Status is "active"
    // 2. Last sync is null OR last sync + sync interval < now
    const dueIntegrations = await db
      .select({
        id: brandIntegrations.id,
        brandId: brandIntegrations.brandId,
        syncInterval: brandIntegrations.syncInterval,
        lastSyncAt: brandIntegrations.lastSyncAt,
        integrationSlug: integrations.slug,
        integrationName: integrations.name,
      })
      .from(brandIntegrations)
      .innerJoin(
        integrations,
        eq(brandIntegrations.integrationId, integrations.id),
      )
      .where(
        and(
          eq(brandIntegrations.status, "active"),
          or(
            isNull(brandIntegrations.lastSyncAt),
            // Check if lastSyncAt + syncInterval hours < now
            sql`${brandIntegrations.lastSyncAt} + (${brandIntegrations.syncInterval} || ' hours')::interval < ${now.toISOString()}`,
          ),
        ),
      );

    logger.info("Found integrations due for sync", {
      count: dueIntegrations.length,
    });

    if (dueIntegrations.length === 0) {
      logger.info("No integrations due for sync");
      return { triggered: 0 };
    }

    // Trigger sync for each due integration
    const triggered: string[] = [];
    const errors: Array<{ id: string; error: string }> = [];

    for (const integration of dueIntegrations) {
      try {
        logger.info("Triggering sync for integration", {
          brandIntegrationId: integration.id,
          brandId: integration.brandId,
          integrationSlug: integration.integrationSlug,
          lastSyncAt: integration.lastSyncAt,
          syncInterval: integration.syncInterval,
        });

        // Trigger the sync task
        await syncIntegration.trigger({
          brandIntegrationId: integration.id,
          brandId: integration.brandId,
          triggerType: "scheduled",
        });

        triggered.push(integration.id);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        logger.error("Failed to trigger sync for integration", {
          brandIntegrationId: integration.id,
          error: errorMessage,
        });
        errors.push({ id: integration.id, error: errorMessage });
      }
    }

    logger.info("Scheduler run completed", {
      triggered: triggered.length,
      errors: errors.length,
    });

    return {
      triggered: triggered.length,
      triggeredIds: triggered,
      errors,
    };
  },
});
