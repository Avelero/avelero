/**
 * Shopify Connector
 *
 * Exports the Shopify connector schema, client, and related utilities.
 *
 * @see plan-integration.md Section 5.4 for architecture details
 */

export {
  shopifySchema,
  SHOPIFY_PRODUCT_VARIANTS_QUERY,
  SHOPIFY_BATCH_SIZE,
} from "./schema";

export {
  testConnection,
  fetchVariants,
  estimateVariantCount,
  extractNumericId,
} from "./client";
