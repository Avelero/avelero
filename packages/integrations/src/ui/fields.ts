/**
 * Connector Field Definitions (Client-Safe)
 *
 * This file exports field metadata for each connector that can be safely
 * used on both client and server. It derives data from:
 * - Shopify connector schema (field keys and entity mappings)
 * - Field registry (labels, descriptions, categories)
 *
 * Transform functions are NOT included as they cannot be serialized.
 *
 * @see packages/integrations/src/connectors/shopify/schema.ts
 * @see packages/integrations/src/registry/field-registry.ts
 */

import { fieldRegistry, type FieldCategory } from "../registry/field-registry";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Client-safe field definition for the setup wizard.
 */
export interface ConnectorFieldMeta {
  /** Field key (e.g., "product.name", "variant.sku") */
  fieldKey: string;
  /** Human-readable label */
  label: string;
  /** Description of what this field contains */
  description: string;
  /** Entity this field belongs to ("product" or "variant") */
  entity: "product" | "variant";
  /** UI category for grouping */
  category: FieldCategory;
  /** If true, this field is always synced and cannot be disabled by the user */
  required: boolean;
}

// =============================================================================
// SHOPIFY FIELDS
// =============================================================================

/**
 * Field keys from the Shopify connector schema.
 * These match the keys in packages/jobs/src/lib/integrations/connectors/shopify/schema.ts
 *
 * NOTE: EAN and GTIN are NOT included - Shopify only syncs SKU and barcode.
 * NOTE: productHandle is NOT included - it's auto-generated from product title
 *       and used for DPP QR codes, so it must remain stable.
 */
const SHOPIFY_FIELD_KEYS = [
  // Variant fields (for matching)
  "variant.sku",
  "variant.barcode",
  "variant.colorId",
  "variant.sizeId",
  // Product fields
  "product.name",
  "product.description",
  "product.primaryImagePath",
  "product.webshopUrl",
  "product.price",
  "product.currency",
  "product.salesStatus",
  // NOTE: product.categoryId is not included - categories are system-level
  // and require a mapping feature that will be added in a future update.
  "product.tags",
] as const;

/**
 * Fields that are ALWAYS synced and cannot be disabled.
 * These are essential for the integration to work properly.
 */
const SHOPIFY_REQUIRED_FIELDS = new Set([
  "product.webshopUrl",
  "product.price",
  "product.currency",
  "product.salesStatus",
]);

/**
 * Custom descriptions for Shopify-specific behavior.
 * Falls back to field registry description if not specified.
 */
const SHOPIFY_FIELD_DESCRIPTIONS: Partial<Record<string, string>> = {
  "variant.sku": "Stock Keeping Unit - primary identifier for matching variants",
  "variant.barcode": "Variant barcode - secondary identifier for matching",
  "variant.colorId": "Color extracted from Shopify variant options",
  "variant.sizeId": "Size extracted from Shopify variant options",
  "product.name": "Product display name from Shopify",
  "product.description": "Product description text from Shopify",
  "product.primaryImagePath": "Product image URL from Shopify",
  "product.webshopUrl": "URL to the product on the online store",
  "product.price": "Product price from variant",
  "product.currency": "Currency code from Shopify shop settings",
  "product.salesStatus": "Availability status derived from Shopify product status",
  "product.tags": "Product tags synced as brand tags",
};

/**
 * Build Shopify field metadata by combining schema keys with registry data.
 */
function buildShopifyFields(): ConnectorFieldMeta[] {
  return SHOPIFY_FIELD_KEYS.map((fieldKey) => {
    const registryField = fieldRegistry[fieldKey];
    const [entity] = fieldKey.split(".") as [
      "product" | "variant",
      string,
    ];

    // Get category - variant fields are in "variants" category in registry
    // but we want to show them grouped by entity
    let category: FieldCategory = registryField?.category ?? "basic";
    if (entity === "variant" && !registryField) {
      category = "variants";
    }

    return {
      fieldKey,
      label: registryField?.label ?? formatFieldLabel(fieldKey),
      description:
        SHOPIFY_FIELD_DESCRIPTIONS[fieldKey] ??
        registryField?.description ??
        `${formatFieldLabel(fieldKey)} from Shopify`,
      entity,
      category,
      required: SHOPIFY_REQUIRED_FIELDS.has(fieldKey),
    };
  });
}

/**
 * Format a field key into a human-readable label.
 * "variant.colorId" -> "Color Id"
 */
function formatFieldLabel(fieldKey: string): string {
  const [, fieldName] = fieldKey.split(".");
  if (!fieldName) return fieldKey;

  return fieldName
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Shopify connector field metadata.
 * Use this for the field setup wizard.
 */
export const SHOPIFY_FIELDS: readonly ConnectorFieldMeta[] = buildShopifyFields();

/**
 * Get fields for a specific connector.
 */
export function getConnectorFields(
  connectorSlug: string,
): readonly ConnectorFieldMeta[] {
  switch (connectorSlug) {
    case "shopify":
      return SHOPIFY_FIELDS;
    default:
      return [];
  }
}

// Re-export category labels from constants
export { FIELD_CATEGORY_LABELS } from "./constants";
