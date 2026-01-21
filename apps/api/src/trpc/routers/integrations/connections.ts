/**
 * Integration connections router.
 *
 * Handles connection management for integrations:
 * - List available integration types
 * - List brand's connected integrations
 * - Connect new integrations (API key only - OAuth uses HTTP endpoints)
 * - Disconnect integrations
 * - Test connection credentials
 *
 * @module trpc/routers/integrations/connections
 */
import { auth, tasks } from "@trigger.dev/sdk/v3";
import {
  createBrandIntegration,
  deleteBrandIntegration,
  getBrandIntegration,
  getBrandIntegrationBySlug,
  getCurrentPrimaryIntegration,
  getIntegrationBySlug,
  getIntegrationVariantCount,
  listIntegrationsWithStatus,
  setBrandIntegrationPrimary,
  updateBrandIntegration,
} from "@v1/db/queries/integrations";
import { decryptCredentials, encryptCredentials } from "@v1/db/utils";
import { testIntegrationConnection } from "@v1/integrations";
import {
  connectApiKeySchema,
  disconnectSchema,
  getIntegrationBySlugSchema,
  getIntegrationSchema,
  listIntegrationsSchema,
  promoteToPrimarySchema,
  testConnectionSchema,
  updateIntegrationSchema,
} from "../../../schemas/integrations.js";
import {
  alreadyExists,
  badRequest,
  notFound,
  wrapError,
} from "../../../utils/errors.js";
import {
  createEntityResponse,
  createListResponse,
  createSuccessResponse,
  createSuccessWithMeta,
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Connections sub-router for integration management.
 *
 * Endpoints:
 * - list: List all integrations with connection status
 * - get: Get a specific brand integration by ID
 * - getBySlug: Get a brand integration by integration slug
 * - connect: Connect a new API key integration
 * - update: Update integration settings
 * - disconnect: Disconnect an integration
 * - testConnection: Test integration credentials
 */
export const connectionsRouter = createTRPCRouter({
  /**
   * List all integrations with connection status.
   *
   * Returns all available integrations with connection info if connected.
   */
  list: brandRequiredProcedure
    .input(listIntegrationsSchema)
    .query(async ({ ctx }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const integrations = await listIntegrationsWithStatus(
          brandCtx.db,
          brandCtx.brandId,
        );
        return createListResponse(integrations);
      } catch (error) {
        throw wrapError(error, "Failed to list integrations");
      }
    }),

  /**
   * Get a specific brand integration by ID.
   *
   * Returns detailed information including sync status.
   * Does NOT return decrypted credentials.
   */
  get: brandRequiredProcedure
    .input(getIntegrationSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!integration) {
          throw notFound("Integration", input.id);
        }
        // Remove credentials from response
        const { credentials, credentialsIv, ...safeIntegration } = integration;
        return createEntityResponse(safeIntegration);
      } catch (error) {
        throw wrapError(error, "Failed to get integration");
      }
    }),

  /**
   * Get a brand integration by integration slug.
   *
   * Useful for checking if a specific integration type is already connected.
   */
  getBySlug: brandRequiredProcedure
    .input(getIntegrationBySlugSchema)
    .query(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const integration = await getBrandIntegrationBySlug(
          brandCtx.db,
          brandCtx.brandId,
          input.slug,
        );
        if (!integration) {
          return createEntityResponse(null);
        }
        // Remove credentials from response
        const { credentials, credentialsIv, ...safeIntegration } = integration;
        return createEntityResponse(safeIntegration);
      } catch (error) {
        throw wrapError(error, "Failed to get integration by slug");
      }
    }),

  /**
   * Connect a new API key integration.
   *
   * For OAuth integrations (like Shopify), use the HTTP OAuth endpoints instead.
   *
   * Steps:
   * 1. Validate integration exists and supports API key auth
   * 2. Check brand doesn't already have this integration
   * 3. Encrypt credentials
   * 4. Create brand integration record
   */
  connect: brandRequiredProcedure
    .input(connectApiKeySchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // 1. Get the integration type
        const integration = await getIntegrationBySlug(
          brandCtx.db,
          input.integration_slug,
        );
        if (!integration) {
          throw notFound("Integration type", input.integration_slug);
        }

        // 2. Verify it's an API key integration
        if (integration.authType !== "api_key") {
          throw badRequest(
            `Integration "${integration.name}" requires OAuth authentication. Use the OAuth flow instead.`,
          );
        }

        // 3. Check if already connected
        const existing = await getBrandIntegrationBySlug(
          brandCtx.db,
          brandCtx.brandId,
          input.integration_slug,
        );
        if (existing) {
          throw alreadyExists("Integration connection", integration.name);
        }

        // 4. Encrypt credentials
        const credentialsData: Record<string, unknown> = {
          apiKey: input.api_key,
        };
        if (input.api_secret) {
          credentialsData.apiSecret = input.api_secret;
        }
        if (input.base_url) {
          credentialsData.baseUrl = input.base_url;
        }

        const { encrypted, iv } = encryptCredentials(credentialsData);

        // 5. Create brand integration
        const result = await createBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          {
            integrationId: integration.id,
            credentials: encrypted,
            credentialsIv: iv,
            syncInterval: input.sync_interval ?? 86400, // Default 24 hours
            status: "active",
          },
        );

        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, "Failed to connect integration");
      }
    }),

  /**
   * Update integration settings.
   *
   * Allows updating:
   * - Sync interval
   * - Status (pause/resume)
   * - Match identifier (for secondary integrations)
   * - Primary status (will demote current primary if setting to true)
   */
  update: brandRequiredProcedure
    .input(updateIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // If setting is_primary to true, use special atomic operation
        if (input.is_primary === true) {
          await setBrandIntegrationPrimary(
            brandCtx.db,
            brandCtx.brandId,
            input.id,
          );
        }

        // Update other fields
        const result = await updateBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
          {
            syncInterval: input.sync_interval,
            status: input.status,
            matchIdentifier: input.match_identifier,
            // Only set isPrimary to false here (true is handled above)
            isPrimary: input.is_primary === false ? false : undefined,
          },
        );
        if (!result) {
          throw notFound("Integration", input.id);
        }
        return createEntityResponse(result);
      } catch (error) {
        throw wrapError(error, "Failed to update integration");
      }
    }),

  /**
   * Disconnect an integration.
   *
   * This will:
   * - Delete the brand integration record
   * - Cascade delete all field configs, sync jobs, and links
   *
   * Products and their data are NOT deleted - only the integration link is removed.
   */
  disconnect: brandRequiredProcedure
    .input(disconnectSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const result = await deleteBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!result) {
          throw notFound("Integration", input.id);
        }
        return createSuccessResponse();
      } catch (error) {
        throw wrapError(error, "Failed to disconnect integration");
      }
    }),

  /**
   * Test integration credentials.
   *
   * Decrypts stored credentials and attempts to connect to the integration's API.
   * Returns success/failure status.
   */
  testConnection: brandRequiredProcedure
    .input(testConnectionSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Get the integration with credentials
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!integration) {
          throw notFound("Integration", input.id);
        }

        // Decrypt credentials
        if (!integration.credentials || !integration.credentialsIv) {
          throw badRequest("Integration has no stored credentials");
        }

        const credentials = decryptCredentials(
          integration.credentials,
          integration.credentialsIv,
        );

        // Add shop domain to credentials for Shopify
        if (
          integration.integration?.slug === "shopify" &&
          integration.shopDomain
        ) {
          credentials.shopDomain = integration.shopDomain;
        }

        // Test connection using the integration's connector
        const integrationSlug = integration.integration?.slug;
        if (!integrationSlug) {
          throw badRequest("Integration type not found");
        }

        const testResult = await testIntegrationConnection(
          integrationSlug,
          credentials,
        );

        return createEntityResponse({
          success: testResult.success,
          message: testResult.message,
          data: testResult.data,
        });
      } catch (error) {
        // If decryption failed, it's likely a credentials issue
        // AES-256-GCM throws "Unsupported state or unable to authenticate data" on auth tag failure
        if (
          error instanceof Error &&
          (error.message.includes("authenticate data") ||
            error.message.includes("Unsupported state") ||
            error.message.includes("decrypt"))
        ) {
          return createEntityResponse({
            success: false,
            message:
              "Failed to decrypt credentials. Please reconnect the integration.",
          });
        }
        throw wrapError(error, "Failed to test connection");
      }
    }),

  /**
   * Promote an integration to primary.
   *
   * This will trigger the re-grouping algorithm that:
   * - Re-parents variants based on the new primary's product structure
   * - Updates canonical links
   * - Archives empty products
   * - Re-assigns attributes
   *
   * The operation runs asynchronously as a background job.
   * If no variants exist, the promotion happens instantly.
   */
  promoteToPrimary: brandRequiredProcedure
    .input(promoteToPrimarySchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        // Verify the integration exists and belongs to this brand
        const integration = await getBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
        );
        if (!integration) {
          throw notFound("Integration", input.id);
        }

        // Check if already primary
        if (integration.isPrimary) {
          throw badRequest(
            "This integration is already the primary integration",
          );
        }

        // Check if there are any variants to regroup
        const variantCount = await getIntegrationVariantCount(
          brandCtx.db,
          brandCtx.brandId,
        );

        if (variantCount === 0) {
          // No variants exist - instant promotion (no regrouping needed)
          await setBrandIntegrationPrimary(
            brandCtx.db,
            brandCtx.brandId,
            input.id,
          );

          return createSuccessWithMeta({
            instant: true,
            message: "Promoted to primary (no products to regroup)",
          });
        }

        // Trigger the background promotion job
        const handle = await tasks.trigger("promote-integration", {
          brandIntegrationId: input.id,
          brandId: brandCtx.brandId,
        });

        // Generate a public access token for the client to subscribe to realtime updates
        const publicToken = await auth.createPublicToken({
          scopes: {
            read: { runs: [handle.id] },
          },
        });

        return createSuccessWithMeta({
          taskId: handle.id,
          publicAccessToken: publicToken,
          message: "Promotion started",
        });
      } catch (error) {
        throw wrapError(error, "Failed to start promotion");
      }
    }),
});

type ConnectionsRouter = typeof connectionsRouter;
