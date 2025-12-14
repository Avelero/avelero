/**
 * Integration Sync Task
 *
 * On-demand task for syncing data from external systems.
 * Can be triggered manually from the UI or via API.
 *
 * @see plan-integration.md Phase 4 for architecture details
 */

import "./configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  createSyncJob,
  getBrandIntegration,
  getIntegrationById,
  listFieldConfigs,
  updateSyncJob,
} from "@v1/db/queries";
import { decryptCredentials } from "@v1/db/utils";
import { syncVariants } from "../lib/integrations";
import type {
  FieldConfig,
  IntegrationCredentials,
  SyncContext,
} from "../lib/integrations";

// =============================================================================
// TYPES
// =============================================================================

interface SyncIntegrationPayload {
  /** Brand integration ID to sync */
  brandIntegrationId: string;
  /** Brand ID (for context) */
  brandId: string;
  /** Trigger type for the sync job */
  triggerType?: "manual" | "scheduled" | "webhook";
}

// =============================================================================
// TASK
// =============================================================================

export const syncIntegration = task({
  id: "sync-integration",
  // Allow up to 30 minutes for large syncs
  maxDuration: 1800,
  run: async (payload: SyncIntegrationPayload) => {
    const { brandIntegrationId, brandId, triggerType = "manual" } = payload;

    logger.info("Starting integration sync", {
      brandIntegrationId,
      brandId,
      triggerType,
    });

    // Create sync job record
    const syncJob = await createSyncJob(db, {
      brandIntegrationId,
      triggerType,
      status: "running",
    });

    if (!syncJob) {
      throw new Error("Failed to create sync job");
    }

    const syncJobId = syncJob.id;

    try {
      // Mark job as started
      await updateSyncJob(db, syncJobId, {
        startedAt: new Date().toISOString(),
      });

      // Get brand integration details
      const brandIntegration = await getBrandIntegration(
        db,
        brandId,
        brandIntegrationId,
      );
      if (!brandIntegration) {
        throw new Error(`Brand integration not found: ${brandIntegrationId}`);
      }

      // Get integration type details
      const integration = await getIntegrationById(
        db,
        brandIntegration.integrationId,
      );
      if (!integration) {
        throw new Error(
          `Integration not found: ${brandIntegration.integrationId}`,
        );
      }

      logger.info("Loaded integration configuration", {
        integrationSlug: integration.slug,
        integrationName: integration.name,
        shopDomain: brandIntegration.shopDomain,
      });

      // Decrypt credentials
      if (!brandIntegration.credentials || !brandIntegration.credentialsIv) {
        throw new Error("Integration credentials not configured");
      }

      const credentials = decryptCredentials<IntegrationCredentials>(
        brandIntegration.credentials,
        brandIntegration.credentialsIv,
      );

      // Add shop domain to credentials for Shopify
      if (integration.slug === "shopify" && brandIntegration.shopDomain) {
        credentials.shopDomain = brandIntegration.shopDomain;
      }

      // Get field configurations
      const fieldConfigs = await listFieldConfigs(db, brandIntegrationId);
      const mappedFieldConfigs: FieldConfig[] = fieldConfigs.map((fc) => ({
        fieldKey: fc.fieldKey,
        isEnabled: fc.ownershipEnabled,
        selectedSource: fc.sourceOptionKey,
      }));

      logger.info("Loaded field configurations", {
        fieldCount: mappedFieldConfigs.length,
        enabledCount: mappedFieldConfigs.filter((fc) => fc.isEnabled).length,
      });

      // Build sync context
      const ctx: SyncContext = {
        db,
        brandId,
        brandIntegrationId,
        integrationSlug: integration.slug,
        credentials,
        config: {},
        fieldConfigs: mappedFieldConfigs,
      };

      // Run sync
      logger.info("Starting variant sync");
      const result = await syncVariants(ctx);

      logger.info("Sync completed", {
        success: result.success,
        variantsProcessed: result.variantsProcessed,
        variantsCreated: result.variantsCreated,
        variantsUpdated: result.variantsUpdated,
        variantsSkipped: result.variantsSkipped,
        variantsFailed: result.variantsFailed,
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        entitiesCreated: result.entitiesCreated,
        errorCount: result.errors.length,
      });

      // Update sync job with results
      await updateSyncJob(db, syncJobId, {
        status: result.success ? "completed" : "failed",
        finishedAt: new Date().toISOString(),
        productsProcessed: result.variantsProcessed, // Variants processed (main stat)
        productsCreated: result.productsCreated,
        productsUpdated: result.productsUpdated,
        productsFailed: result.variantsFailed,
        productsSkipped: result.variantsSkipped,
        entitiesCreated: result.entitiesCreated,
        errorSummary:
          result.errors.length > 0
            ? `${result.errors.length} errors occurred`
            : null,
        errorLog: result.errors.length > 0 ? result.errors : null,
      });

      return {
        success: result.success,
        syncJobId,
        stats: {
          variantsProcessed: result.variantsProcessed,
          variantsCreated: result.variantsCreated,
          variantsUpdated: result.variantsUpdated,
          variantsSkipped: result.variantsSkipped,
          variantsFailed: result.variantsFailed,
          productsCreated: result.productsCreated,
          productsUpdated: result.productsUpdated,
          entitiesCreated: result.entitiesCreated,
        },
      };
    } catch (error) {
      logger.error("Sync failed with error", {
        error: error instanceof Error ? error.message : String(error),
        syncJobId,
      });

      // Update sync job as failed
      await updateSyncJob(db, syncJobId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        errorSummary: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  },
});
