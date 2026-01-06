/**
 * Integration Promotion Task
 *
 * Background task for promoting a secondary integration to primary.
 * This triggers a complete re-grouping of products based on the new primary's structure.
 *
 * This is a long-running operation that can take several minutes for large datasets.
 * The task supports resumability - if it fails, it can be resumed from the last checkpoint.
 *
 * @see integration-refactor-plan.md Section 2.5 for algorithm details
 */

import "../configure-trigger";
import { logger, task } from "@trigger.dev/sdk/v3";
import { serviceDb as db } from "@v1/db/client";
import {
  getBrandIntegration,
  getCurrentPrimaryIntegration,
  getIntegrationById,
  updateBrandIntegration,
} from "@v1/db/queries/integrations";
import { decryptCredentials } from "@v1/db/utils";
import {
  type IntegrationCredentials,
  type PromotionProgress,
  promoteIntegrationToPrimary,
} from "@v1/integrations";

// =============================================================================
// TYPES
// =============================================================================

interface PromoteIntegrationPayload {
  /** Brand integration ID to promote */
  brandIntegrationId: string;
  /** Brand ID (for context) */
  brandId: string;
}

// =============================================================================
// TASK
// =============================================================================

export const promoteIntegration = task({
  id: "promote-integration",
  // Allow up to 60 minutes for large re-grouping operations
  maxDuration: 3600,
  run: async (payload: PromoteIntegrationPayload) => {
    const { brandIntegrationId, brandId } = payload;

    logger.info("Starting integration promotion", {
      brandIntegrationId,
      brandId,
    });

    try {
      // Get brand integration details
      const brandIntegration = await getBrandIntegration(
        db,
        brandId,
        brandIntegrationId,
      );
      if (!brandIntegration) {
        throw new Error(`Brand integration not found: ${brandIntegrationId}`);
      }

      // Check if already primary
      if (brandIntegration.isPrimary) {
        logger.warn("Integration is already primary", { brandIntegrationId });
        return {
          success: true,
          message: "Integration is already primary",
          alreadyPrimary: true,
        };
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

      // Get current primary integration (if any)
      const currentPrimary = await getCurrentPrimaryIntegration(db, brandId);

      // Progress callback
      const onProgress = async (progress: PromotionProgress) => {
        logger.info("Promotion progress", {
          phase: progress.phase,
          phaseNumber: progress.phaseNumber,
          variantsProcessed: progress.variantsProcessed,
          totalVariants: progress.totalVariants,
          productsCreated: progress.productsCreated,
          variantsMoved: progress.variantsMoved,
          variantsOrphaned: progress.variantsOrphaned,
        });
      };

      // Run promotion
      logger.info("Starting promotion operation");
      const result = await promoteIntegrationToPrimary(
        db,
        {
          brandId,
          newPrimaryIntegrationId: brandIntegrationId,
          oldPrimaryIntegrationId: currentPrimary?.id ?? null,
        },
        credentials,
        integration.slug,
        onProgress,
      );

      logger.info("Promotion completed", {
        success: result.success,
        operationId: result.operationId,
        stats: result.stats,
        error: result.error,
      });

      // Update integration status if successful
      if (result.success) {
        await updateBrandIntegration(db, brandId, brandIntegrationId, {
          status: "active",
        });
      }

      return {
        success: result.success,
        operationId: result.operationId,
        stats: {
          productsCreated: result.stats.productsCreated,
          productsArchived: result.stats.productsArchived,
          variantsMoved: result.stats.variantsMoved,
          variantsOrphaned: result.stats.variantsOrphaned,
          attributesCreated: result.stats.attributesCreated,
        },
        error: result.error,
      };
    } catch (error) {
      logger.error("Promotion failed with error", {
        error: error instanceof Error ? error.message : String(error),
        brandIntegrationId,
      });

      throw error;
    }
  },
});
