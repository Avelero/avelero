/**
 * Integration Sync Task
 *
 * On-demand task for syncing data from external systems.
 * Can be triggered manually from the UI or via API.
 *
 * @see plan-integration.md Phase 4 for architecture details
 */

import "../configure-trigger";
import { createClient } from "@supabase/supabase-js";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  createSyncJob,
  getBrandIntegration,
  getIntegrationById,
  listFieldConfigs,
  updateBrandIntegration,
  updateSyncJob,
} from "@v1/db/queries/integrations";
import { decryptCredentials } from "@v1/db/utils";
import { getConnector } from "@v1/integrations/connectors";
import { syncProducts } from "@v1/integrations/sync";
import type {
  FieldConfig,
  IntegrationCredentials,
  SyncContext,
  SyncProgress,
} from "@v1/integrations/sync";

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

      // Get connector and product count for progress tracking
      const connector = getConnector(integration.slug);
      let productsTotal: number | undefined;
      
      if (connector) {
        try {
          const count = await connector.getProductCount(credentials);
          if (count > 0) {
            productsTotal = count;
            await updateSyncJob(db, syncJobId, { productsTotal });
            logger.info("Got product count", { productsTotal });
          }
        } catch (error) {
          logger.warn("Failed to get product count, progress will be indeterminate", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Create Supabase client for storage operations (image uploads)
      const storageClient = createClient(
        process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_KEY ||
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      // Progress callback to update sync job during processing
      const onProgress = async (progress: SyncProgress) => {
        await updateSyncJob(db, syncJobId, {
          productsProcessed: progress.productsProcessed,
        });
        logger.info("Sync progress", {
          productsProcessed: progress.productsProcessed,
          productsTotal: progress.productsTotal,
        });
      };

      // Build sync context
      const ctx: SyncContext = {
        db,
        storageClient,
        brandId,
        brandIntegrationId,
        integrationSlug: integration.slug,
        credentials,
        config: {},
        fieldConfigs: mappedFieldConfigs,
        productsTotal,
        onProgress,
      };

      // Run sync
      logger.info("Starting product sync");
      const result = await syncProducts(ctx);

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

      // Update brand integration with last sync time
      if (result.success) {
        await updateBrandIntegration(db, brandId, brandIntegrationId, {
          lastSyncAt: new Date().toISOString(),
        });
      }

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
