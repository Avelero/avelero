/**
 * Integration field mappings router.
 *
 * Handles field ownership and mapping configuration:
 * - List field configurations for an integration
 * - Update field ownership settings
 * - List all owned fields across integrations (for conflict detection)
 *
 * NOTE: Uses Supabase client (not Drizzle) for mutations because:
 * - Drizzle doesn't pass the user's auth context to PostgreSQL
 * - RLS policies require the authenticated user context
 * - ctx.supabase has the auth token and works with RLS
 *
 * @module trpc/routers/integrations/mappings
 */
// NOTE: All queries use ctx.supabase instead of Drizzle queries
// because RLS policies require the authenticated user context.
// Drizzle doesn't pass the JWT to PostgreSQL, so auth.uid() returns NULL.
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
        // Use Supabase client for RLS-protected queries
        const { data: integration, error: intError } = await brandCtx.supabase
          .from("brand_integrations")
          .select("id, brand_id")
          .eq("id", input.brand_integration_id)
          .eq("brand_id", brandCtx.brandId)
          .single();

        if (intError || !integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Fetch field configs using Supabase client (for RLS)
        const { data: configs, error } = await brandCtx.supabase
          .from("integration_field_configs")
          .select(
            "id, brand_integration_id, field_key, ownership_enabled, source_option_key, created_at, updated_at",
          )
          .eq("brand_integration_id", input.brand_integration_id)
          .order("field_key");

        if (error) {
          throw new Error(error.message);
        }

        // Transform snake_case to camelCase for consistency
        const transformedConfigs = (configs ?? []).map((c) => ({
          id: c.id,
          brandIntegrationId: c.brand_integration_id,
          fieldKey: c.field_key,
          ownershipEnabled: c.ownership_enabled,
          sourceOptionKey: c.source_option_key,
          createdAt: c.created_at,
          updatedAt: c.updated_at,
        }));

        return createListResponse(transformedConfigs);
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
        const { data: integration, error: intError } = await brandCtx.supabase
          .from("brand_integrations")
          .select("id")
          .eq("id", input.brand_integration_id)
          .eq("brand_id", brandCtx.brandId)
          .single();

        if (intError || !integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Use Supabase client for upsert (RLS requires auth context)
        const { data: result, error } = await brandCtx.supabase
          .from("integration_field_configs")
          .upsert(
            {
              brand_integration_id: input.brand_integration_id,
              field_key: input.field_key,
              ownership_enabled: input.ownership_enabled ?? true,
              source_option_key: input.source_option_key ?? null,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "brand_integration_id,field_key",
            },
          )
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

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
        const { data: integration, error: intError } = await brandCtx.supabase
          .from("brand_integrations")
          .select("id")
          .eq("id", input.brand_integration_id)
          .eq("brand_id", brandCtx.brandId)
          .single();

        if (intError || !integration) {
          throw notFound("Integration", input.brand_integration_id);
        }

        // Use Supabase client for upsert (RLS requires auth context)
        const records = input.fields.map((field) => ({
          brand_integration_id: input.brand_integration_id,
          field_key: field.field_key,
          ownership_enabled: field.ownership_enabled ?? true,
          source_option_key: field.source_option_key ?? null,
          updated_at: new Date().toISOString(),
        }));

        const { data: results, error } = await brandCtx.supabase
          .from("integration_field_configs")
          .upsert(records, {
            onConflict: "brand_integration_id,field_key",
          })
          .select();

        if (error) {
          throw new Error(error.message);
        }

        return createListResponse(results ?? []);
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
        // Fetch owned fields using Supabase client (for RLS)
        // Join with brand_integrations and integrations to get integration info
        const { data: ownedFields, error } = await brandCtx.supabase
          .from("integration_field_configs")
          .select(`
            field_key,
            source_option_key,
            brand_integration_id,
            brand_integrations!inner (
              id,
              brand_id,
              integrations!inner (
                slug,
                name
              )
            )
          `)
          .eq("ownership_enabled", true)
          .eq("brand_integrations.brand_id", brandCtx.brandId);

        if (error) {
          throw new Error(error.message);
        }

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

        for (const field of ownedFields ?? []) {
          const bi = field.brand_integrations as {
            id: string;
            integrations: { slug: string; name: string };
          };
          const existing = fieldMap.get(field.field_key) ?? [];
          existing.push({
            brandIntegrationId: bi.id,
            integrationSlug: bi.integrations.slug,
            integrationName: bi.integrations.name,
            sourceOptionKey: field.source_option_key,
          });
          fieldMap.set(field.field_key, existing);
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
