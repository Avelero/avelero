/**
 * Integration field mappings router.
 *
 * Handles field ownership and mapping configuration:
 * - List field configurations for an integration
 * - Update field ownership settings
 * - List all owned fields across integrations (for conflict detection)
 *
 * @module trpc/routers/integrations/mappings
 */
import {
  getBrandIntegration,
  listAllOwnedFields,
  listFieldConfigs,
  upsertFieldConfig,
} from "@v1/db/queries";
import {
  listAllOwnershipsSchema,
  listFieldMappingsSchema,
  updateFieldMappingSchema,
  updateFieldMappingsBatchSchema,
} from "../../../schemas/integrations.js";
import { notFound, wrapError } from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Mappings sub-router for field configuration.
 *
 * Endpoints:
 * - list: List all field configs for an integration
 * - update: Update a single field config
 * - updateBatch: Update multiple field configs at once
 * - listAllOwnerships: List all owned fields across all integrations
 */
export const mappingsRouter = createTRPCRouter({
  /**
   * List all field configurations for a brand integration.
   *
   * Returns the current ownership and source settings for each field.
   * Fields not in the response use default settings from the connector schema.
   */
  list: brandRequiredProcedure
    .input(listFieldMappingsSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the brand integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        const configs = await listFieldConfigs(
          brandCtx.db,
          input.brand_integration_id,
        );
        return createListResponse(configs);
      } catch (error) {
        throw wrapError(error, "Failed to list field mappings");
      }
    }),

  /**
   * Update a single field configuration.
   *
   * Creates the config if it doesn't exist (upsert).
   * Use this to:
   * - Enable/disable field ownership
   * - Select a source option when multiple are available
   */
  update: brandRequiredProcedure
    .input(updateFieldMappingSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the brand integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        const result = await upsertFieldConfig(
          brandCtx.db,
          input.brand_integration_id,
          input.field_key,
          {
            ownershipEnabled: input.ownership_enabled,
            sourceOptionKey: input.source_option_key,
          },
        );

        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, "Failed to update field mapping");
      }
    }),

  /**
   * Update multiple field configurations at once.
   *
   * Useful for bulk configuration changes from the UI.
   */
  updateBatch: brandRequiredProcedure
    .input(updateFieldMappingsBatchSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the brand integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.brand_integration_id,
        );
        if (!integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Process each field config update
        const results = await Promise.all(
          input.fields.map((field) =>
            upsertFieldConfig(
              brandCtx.db,
              input.brand_integration_id,
              field.field_key,
              {
                ownershipEnabled: field.ownership_enabled,
                sourceOptionKey: field.source_option_key,
              },
            ),
          ),
        );

        return createListResponse(results);
      } catch (error) {
        throw wrapError(error, "Failed to update field mappings");
      }
    }),

  /**
   * List all owned fields across all integrations for a brand.
   *
   * This is useful for detecting field ownership conflicts.
   * If the same field is owned by multiple integrations, only the first
   * one to sync will write the value (conflict detection should be shown in UI).
   */
  listAllOwnerships: brandRequiredProcedure
    .input(listAllOwnershipsSchema)
    .query(async ({ ctx }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const ownedFields = await listAllOwnedFields(brandCtx.db, brandCtx.brandId);

        // Group by field key for easy conflict detection
        const fieldMap = new Map<
          string,
          Array<{
            brandIntegrationId: string;
            integrationSlug: string;
            integrationName: string;
            sourceOptionKey: string | null;
          }>
        >();

        for (const field of ownedFields) {
          const existing = fieldMap.get(field.fieldKey) ?? [];
          existing.push({
            brandIntegrationId: field.brandIntegrationId,
            integrationSlug: field.integrationSlug,
            integrationName: field.integrationName,
            sourceOptionKey: field.sourceOptionKey,
          });
          fieldMap.set(field.fieldKey, existing);
        }

        // Convert to array with conflict flag
        const result = Array.from(fieldMap.entries()).map(
          ([fieldKey, owners]) => ({
            fieldKey,
            owners,
            hasConflict: owners.length > 1,
          }),
        );

        return createListResponse(result);
      } catch (error) {
        throw wrapError(error, "Failed to list field ownerships");
      }
    }),
});

export type MappingsRouter = typeof mappingsRouter;
