/**
 * Sync Context Factory
 *
 * Creates SyncContext objects for testing.
 * Provides default field configs and mock storage client.
 */

import type { SyncContext, FieldConfig, StorageClient } from "../../src/types";
import { testDb } from "./test-db";

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
 * Returns a fake path for any upload.
 */
const mockStorageClient: StorageClient = {
    upload: async ({ path }: { path: string }) => ({
        data: { path: `mock/${path}` },
        error: null,
    }),
    getPublicUrl: (bucket: string, path: string) => ({
        data: { publicUrl: `https://mock.storage.example.com/${bucket}/${path}` },
    }),
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
 */
export function createFieldConfigs(
    overrides: Partial<Record<string, boolean>> = {}
): FieldConfig[] {
    return defaultFieldConfigs.map((config) => ({
        ...config,
        isEnabled: overrides[config.fieldKey] ?? config.isEnabled,
    }));
}
