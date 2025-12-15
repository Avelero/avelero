/**
 * Shopify Connector Exports
 */

// Configuration
export * from "./config";

// Types
export * from "./types";

// Field mappings & transforms
export * from "./mappings";

// Category mappings (Shopify taxonomy → Avelero categories)
export {
  resolveShopifyCategoryId,
  resolveShopifyCategoryName, // Legacy alias for resolveShopifyCategoryId
} from "./category-mappings";

// Schema
export { shopifySchema, SHOPIFY_PRODUCT_VARIANTS_QUERY } from "./schema";

// Client
export {
  testConnection,
  fetchVariants,
  estimateVariantCount,
  extractNumericId,
} from "./client";

// OAuth
export * from "./oauth";
