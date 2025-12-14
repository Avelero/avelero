/**
 * Validation schemas for integration management operations.
 *
 * These schemas back the tRPC procedures that manage integrations:
 * - Connection management (connect, disconnect, test)
 * - Field mapping configuration
 * - Sync operations
 *
 * @module schemas/integrations
 */
import { z } from "zod";
import {
  nonNegativeIntSchema,
  paginationLimitSchema,
  shortStringSchema,
  uuidSchema,
} from "./_shared/primitives.js";

// =============================================================================
// Shared Schemas
// =============================================================================

/**
 * Integration slug schema.
 * Valid slugs: "shopify", "its-perfect"
 */
export const integrationSlugSchema = z
  .string()
  .min(1)
  .max(50)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Integration slug must be lowercase alphanumeric with dashes",
  );

/**
 * Brand integration status schema.
 */
export const brandIntegrationStatusSchema = z.enum([
  "pending",
  "active",
  "error",
  "paused",
  "disconnected",
]);

/**
 * Sync job status schema.
 */
export const syncJobStatusSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

/**
 * Sync job trigger type schema.
 */
export const triggerTypeSchema = z.enum(["scheduled", "manual", "webhook"]);

// =============================================================================
// Connection Schemas
// =============================================================================

/**
 * Schema for listing available integration types.
 * No input required - returns all active integrations.
 */
export const listAvailableSchema = z.object({});

/**
 * Schema for listing a brand's connected integrations.
 */
export const listConnectedSchema = z.object({});

/**
 * Schema for getting a specific brand integration by ID.
 */
export const getIntegrationSchema = z.object({
  id: uuidSchema,
});

/**
 * Schema for getting a brand integration by slug.
 */
export const getIntegrationBySlugSchema = z.object({
  slug: integrationSlugSchema,
});

/**
 * Schema for connecting a new API key integration.
 * OAuth integrations use separate HTTP endpoints.
 */
export const connectApiKeySchema = z.object({
  /** The integration type slug (e.g., "its-perfect") */
  integration_slug: integrationSlugSchema,
  /** API key or access token for the integration */
  api_key: z.string().min(1).max(500),
  /** Optional API secret (some integrations require both) */
  api_secret: z.string().min(1).max(500).optional(),
  /** Optional base URL for the API (for self-hosted instances) */
  base_url: z.string().url().optional(),
  /** Sync interval in seconds (default: 21600 = 6 hours) */
  sync_interval: z.number().int().min(3600).max(86400).optional(),
});

/**
 * Schema for updating integration settings.
 */
export const updateIntegrationSchema = z.object({
  /** Brand integration ID */
  id: uuidSchema,
  /** Sync interval in seconds */
  sync_interval: z.number().int().min(3600).max(86400).optional(),
  /** Integration status (only allows pausing/resuming) */
  status: z.enum(["active", "paused"]).optional(),
});

/**
 * Schema for disconnecting an integration.
 */
export const disconnectSchema = z.object({
  /** Brand integration ID */
  id: uuidSchema,
});

/**
 * Schema for testing integration credentials.
 * Returns success/failure and any error message.
 */
export const testConnectionSchema = z.object({
  /** Brand integration ID to test */
  id: uuidSchema,
});

// =============================================================================
// Field Mapping Schemas
// =============================================================================

/**
 * Schema for listing field configurations for an integration.
 */
export const listFieldMappingsSchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
});

/**
 * Schema for updating a single field configuration.
 */
export const updateFieldMappingSchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
  /** Field key from the field registry (e.g., "product.name", "product.price") */
  field_key: shortStringSchema,
  /** Whether this integration should own this field */
  ownership_enabled: z.boolean().optional(),
  /** Source option key when multiple sources are available */
  source_option_key: shortStringSchema.nullable().optional(),
});

/**
 * Schema for batch updating field configurations.
 */
export const updateFieldMappingsBatchSchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
  /** Array of field configs to update */
  fields: z.array(
    z.object({
      field_key: shortStringSchema,
      ownership_enabled: z.boolean().optional(),
      source_option_key: shortStringSchema.nullable().optional(),
    }),
  ),
});

/**
 * Schema for listing all owned fields across all integrations for a brand.
 * Useful for detecting ownership conflicts.
 */
export const listAllOwnershipsSchema = z.object({});

// =============================================================================
// Sync Schemas
// =============================================================================

/**
 * Schema for manually triggering a sync.
 */
export const triggerSyncSchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
});

/**
 * Schema for listing sync history.
 */
export const listSyncHistorySchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
  /** Maximum number of jobs to return (default: 20) */
  limit: paginationLimitSchema.optional(),
  /** Offset for pagination */
  offset: nonNegativeIntSchema.optional(),
});

/**
 * Schema for getting current sync status.
 */
export const getSyncStatusSchema = z.object({
  /** Brand integration ID */
  brand_integration_id: uuidSchema,
});

/**
 * Schema for getting details of a specific sync job.
 */
export const getSyncJobSchema = z.object({
  /** Sync job ID */
  id: uuidSchema,
});

// =============================================================================
// OAuth Schemas (for Shopify OAuth flow)
// =============================================================================

/**
 * Schema for initiating Shopify OAuth flow.
 * Used by the install endpoint.
 */
export const shopifyInstallSchema = z.object({
  /** Shopify shop domain (e.g., "my-store.myshopify.com") */
  shop: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i,
      "Invalid Shopify shop domain",
    ),
});

/**
 * Schema for Shopify OAuth callback.
 * Validates parameters from Shopify's redirect.
 */
export const shopifyCallbackSchema = z.object({
  /** Authorization code from Shopify */
  code: z.string().min(1),
  /** HMAC signature for verification */
  hmac: z.string().min(1),
  /** Shop domain */
  shop: z.string().min(1),
  /** CSRF state token */
  state: z.string().min(1),
  /** Timestamp of the request */
  timestamp: z.string().min(1),
});

// =============================================================================
// Type Exports
// =============================================================================

export type IntegrationSlug = z.infer<typeof integrationSlugSchema>;
export type BrandIntegrationStatus = z.infer<
  typeof brandIntegrationStatusSchema
>;
export type SyncJobStatus = z.infer<typeof syncJobStatusSchema>;
export type TriggerType = z.infer<typeof triggerTypeSchema>;

export type ConnectApiKeyInput = z.infer<typeof connectApiKeySchema>;
export type UpdateIntegrationInput = z.infer<typeof updateIntegrationSchema>;
export type DisconnectInput = z.infer<typeof disconnectSchema>;
export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

export type ListFieldMappingsInput = z.infer<typeof listFieldMappingsSchema>;
export type UpdateFieldMappingInput = z.infer<typeof updateFieldMappingSchema>;
export type UpdateFieldMappingsBatchInput = z.infer<
  typeof updateFieldMappingsBatchSchema
>;

export type TriggerSyncInput = z.infer<typeof triggerSyncSchema>;
export type ListSyncHistoryInput = z.infer<typeof listSyncHistorySchema>;
export type GetSyncStatusInput = z.infer<typeof getSyncStatusSchema>;
export type GetSyncJobInput = z.infer<typeof getSyncJobSchema>;

export type ShopifyInstallInput = z.infer<typeof shopifyInstallSchema>;
export type ShopifyCallbackInput = z.infer<typeof shopifyCallbackSchema>;
