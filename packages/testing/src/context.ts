/**
 * Sync Context Factory
 *
 * Creates SyncContext objects for testing.
 * Provides default field configs and mock storage client.
 *
 * @module @v1/testing/context
 */

// Import types from integrations package
// Note: The types are imported dynamically to avoid circular dependencies
import { testDb } from "./db";

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
    productsTotal?: number;
    onProgress?: (progress: { productsProcessed: number; productsTotal?: number }) => Promise<void>;
}

// =============================================================================
// DEFAULT FIELD CONFIGS
// =============================================================================

/**
 * Default field configurations for Shopify sync.
 * All fields enabled with their default sources.
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
    { fieldKey: "variant.sku", isEnabled: true, selectedSource: "sku" },
    { fieldKey: "variant.barcode", isEnabled: true, selectedSource: "barcode" },
    { fieldKey: "variant.attributes", isEnabled: true, selectedSource: "selectedOptions" },
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
