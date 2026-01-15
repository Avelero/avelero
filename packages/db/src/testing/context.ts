/**
 * Sync Context Factory
 *
 * Creates SyncContext objects for testing.
 * Provides default field configs and mock storage client.
 *
 * @module @v1/db/testing/context
 */

import { testDb } from "./connection";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Field configuration for sync context.
 */
interface FieldConfig {
    fieldKey: string;
    isEnabled: boolean;
    selectedSource: string;
}

/**
 * Identifier type used for variant matching (secondary integrations only).
 */
type MatchIdentifier = "barcode" | "sku";

/**
 * Import the actual StorageClient type from @v1/supabase
 * This ensures type compatibility with the integrations package.
 */
import type { StorageClient } from "@v1/supabase/storage";

/**
 * Sync context interface.
 * This should match the SyncContext type from @v1/integrations.
 */
interface SyncContext {
    db: typeof testDb;
    storageClient: StorageClient;
    brandId: string;
    brandIntegrationId: string;
    integrationSlug: string;
    credentials: {
        accessToken: string;
        shopDomain: string;
    };
    config: Record<string, unknown>;
    fieldConfigs: FieldConfig[];
    /**
     * Whether this is the primary integration for the brand.
     * Primary integrations create products/variants/attributes.
     * Secondary integrations can only enrich existing products.
     */
    isPrimary: boolean;
    /**
     * Identifier used for matching variants (secondary integrations only).
     * Primary integrations ignore this and use link-based matching.
     */
    matchIdentifier: MatchIdentifier;
    productsTotal?: number;
    onProgress?: (progress: { productsProcessed: number; productsTotal?: number }) => Promise<void>;
}

// =============================================================================
// DEFAULT FIELD CONFIGS
// =============================================================================

/**
 * Default field configurations for Shopify sync.
 * All configurable fields enabled with their default sources.
 * 
 * NOTE: variant.sku, variant.barcode, and variant.attributes are NOT included.
 * These are always-enabled structural fields that don't need configuration.
 */
const defaultFieldConfigs: FieldConfig[] = [
    { fieldKey: "product.name", isEnabled: true, selectedSource: "title" },
    { fieldKey: "product.description", isEnabled: true, selectedSource: "description" },
    { fieldKey: "product.imagePath", isEnabled: true, selectedSource: "featured_image" },
    { fieldKey: "product.webshopUrl", isEnabled: true, selectedSource: "online_store_url" },
    { fieldKey: "product.salesStatus", isEnabled: true, selectedSource: "status" },
    { fieldKey: "product.tags", isEnabled: true, selectedSource: "tags" },
    { fieldKey: "product.categoryId", isEnabled: true, selectedSource: "category" },
    { fieldKey: "product.price", isEnabled: true, selectedSource: "price" },
    { fieldKey: "product.currency", isEnabled: true, selectedSource: "currency" },
];

// =============================================================================
// MOCK STORAGE CLIENT
// =============================================================================

/**
 * Mock storage client for testing.
 * Matches the structure of Pick<SupabaseClient, "storage">.
 * Returns a fake path for any upload.
 * 
 * Uses `as unknown as StorageClient` because we only implement the subset
 * of methods that are actually used by the sync engine.
 */
const mockStorageClient = {
    storage: {
        from: (bucket: string) => ({
            upload: async (path: string, _file: unknown, _options?: unknown) => ({
                data: { path: `${bucket}/${path}` },
                error: null,
            }),
            getPublicUrl: (path: string) => ({
                data: { publicUrl: `https://mock.storage.example.com/${bucket}/${path}` },
            }),
            download: async (_path: string) => ({
                data: null,
                error: null,
            }),
            remove: async (_paths: string[]) => ({
                data: null,
                error: null,
            }),
            list: async (_folderPath: string) => ({
                data: [],
                error: null,
            }),
            createSignedUrl: async (path: string, _expiresIn: number) => ({
                data: { signedUrl: `https://mock.storage.example.com/${bucket}/${path}?signed=true` },
                error: null,
            }),
        }),
    },
} as unknown as StorageClient;

// =============================================================================
// CONTEXT FACTORY
// =============================================================================

interface CreateSyncContextOptions {
    brandId: string;
    brandIntegrationId: string;
    integrationSlug?: string;
    fieldConfigs?: FieldConfig[];
    enabledFields?: Partial<Record<string, boolean>>;
    /**
     * Whether this is the primary integration.
     * Defaults to true for backwards compatibility.
     */
    isPrimary?: boolean;
    /**
     * Identifier used for matching (secondary integrations only).
     * Defaults to 'barcode'.
     */
    matchIdentifier?: MatchIdentifier;
    productsTotal?: number;
    onProgress?: (progress: { productsProcessed: number; productsTotal?: number }) => Promise<void>;
}

/**
 * Create a SyncContext for testing.
 *
 * @example
 * ```ts
 * const ctx = createTestSyncContext({
 *   brandId: "brand-123",
 *   brandIntegrationId: "bi-456",
 *   productsTotal: 10,
 * });
 * const result = await syncProducts(ctx);
 * ```
 */
export function createTestSyncContext(options: CreateSyncContextOptions): SyncContext {
    let fieldConfigs = options.fieldConfigs ?? [...defaultFieldConfigs];

    // Apply field enable/disable overrides
    if (options.enabledFields) {
        fieldConfigs = fieldConfigs.map((config) => ({
            ...config,
            isEnabled: options.enabledFields?.[config.fieldKey] ?? config.isEnabled,
        }));
    }

    return {
        db: testDb,
        storageClient: mockStorageClient,
        brandId: options.brandId,
        brandIntegrationId: options.brandIntegrationId,
        integrationSlug: options.integrationSlug ?? "shopify",
        credentials: {
            accessToken: "test-access-token",
            shopDomain: "test-shop.myshopify.com",
        },
        config: {},
        fieldConfigs,
        isPrimary: options.isPrimary ?? true,
        matchIdentifier: options.matchIdentifier ?? "barcode",
        productsTotal: options.productsTotal,
        onProgress: options.onProgress,
    };
}

/**
 * Create field configs with custom enable/disable settings.
 *
 * @example
 * ```ts
 * const configs = createFieldConfigs({
 *   "product.tags": false,
 *   "product.categoryId": false,
 * });
 * ```
 */
export function createFieldConfigs(
    overrides: Partial<Record<string, boolean>> = {}
): FieldConfig[] {
    return defaultFieldConfigs.map((config) => ({
        ...config,
        isEnabled: overrides[config.fieldKey] ?? config.isEnabled,
    }));
}

// Re-export types
export type { SyncContext, FieldConfig, StorageClient, CreateSyncContextOptions };
