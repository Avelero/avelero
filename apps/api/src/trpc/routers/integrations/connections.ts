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
import {
  createBrandIntegration,
  deleteBrandIntegration,
  getBrandIntegration,
  getBrandIntegrationBySlug,
  getIntegrationBySlug,
  listAvailableIntegrations,
  listBrandIntegrations,
  updateBrandIntegration,
} from "@v1/db/queries";
import { encryptCredentials, decryptCredentials } from "@v1/db/utils";
import {
  connectApiKeySchema,
  disconnectSchema,
  getIntegrationBySlugSchema,
  getIntegrationSchema,
  listAvailableSchema,
  listConnectedSchema,
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
} from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

/** tRPC context with guaranteed brand ID from middleware */
type BrandContext = AuthenticatedTRPCContext & { brandId: string };

/**
 * Connections sub-router for integration management.
 *
 * Endpoints:
 * - listAvailable: List all active integration types
 * - list: List brand's connected integrations
 * - get: Get a specific brand integration by ID
 * - getBySlug: Get a brand integration by integration slug
 * - connect: Connect a new API key integration
 * - update: Update integration settings
 * - disconnect: Disconnect an integration
 * - testConnection: Test integration credentials
 */
export const connectionsRouter = createTRPCRouter({
  /**
   * List all available integration types.
   *
   * Returns integrations that are active and can be connected.
   * Does not require brand context (informational only).
   */
  listAvailable: brandRequiredProcedure
    .input(listAvailableSchema)
    .query(async ({ ctx }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const integrations = await listAvailableIntegrations(brandCtx.db);
        return createListResponse(integrations);
      } catch (error) {
        throw wrapError(error, "Failed to list available integrations");
      }
    }),

  /**
   * List all integrations connected to the current brand.
   *
   * Returns connected integrations with status and sync info.
   */
  list: brandRequiredProcedure
    .input(listConnectedSchema)
    .query(async ({ ctx }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const integrations = await listBrandIntegrations(
          brandCtx.db,
          brandCtx.brandId,
        );
        return createListResponse(integrations);
      } catch (error) {
        throw wrapError(error, "Failed to list connected integrations");
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
        const result = await createBrandIntegration(brandCtx.db, brandCtx.brandId, {
          integrationId: integration.id,
          credentials: encrypted,
          credentialsIv: iv,
          syncInterval: input.sync_interval ?? 21600, // Default 6 hours
          status: "active",
        });

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
   */
  update: brandRequiredProcedure
    .input(updateIntegrationSchema)
    .mutation(async ({ ctx, input }) => {
      const brandCtx = ctx as BrandContext;
      try {
        const result = await updateBrandIntegration(
          brandCtx.db,
          brandCtx.brandId,
          input.id,
          {
            syncInterval: input.sync_interval,
            status: input.status,
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
   *
   * NOTE: Actual test logic will be implemented in Phase 4 when connectors are built.
   * For now, this returns a placeholder response.
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

        // TODO: Phase 4 - Call the connector's testConnection function
        // const connector = getConnector(integration.integration.slug);
        // const testResult = await connector.testConnection(credentials);

        // For now, return success if we could decrypt credentials
        return createEntityResponse({
          success: true,
          message: "Credentials decrypted successfully. Connection test will be available after sync engine implementation.",
        });
      } catch (error) {
        // If decryption failed, it's likely a credentials issue
        if (error instanceof Error && error.message.includes("decrypt")) {
          return createEntityResponse({
            success: false,
            message: "Failed to decrypt credentials. Please reconnect the integration.",
          });
        }
        throw wrapError(error, "Failed to test connection");
      }
    }),
});

export type ConnectionsRouter = typeof connectionsRouter;
