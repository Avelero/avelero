/**
 * Shared field UI configuration for setup wizard and detail view.
 * Centralizes field grouping, labels, and descriptions.
 */
import type { ConnectorFieldMeta } from "@v1/integrations";

// =============================================================================
// Types
// =============================================================================

/** UI grouping for field display */
export type FieldGroup = "product" | "variants" | "organization" | "sales";

// =============================================================================
// Constants
// =============================================================================

export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  product: "Product",
  variants: "Variants",
  organization: "Organization",
  sales: "Sales",
};

/** Order of groups to display */
export const FIELD_GROUP_ORDER: FieldGroup[] = ["product", "variants", "organization", "sales"];

/**
 * Fields hidden from the main field config UI:
 * - salesStatus: always on, managed internally
 * - currency: follows price toggle, managed internally
 * - sku/barcode: managed by identifier toggle
 * - attributes: synced automatically, managed separately
 */
export const HIDDEN_FIELDS = new Set([
  "product.salesStatus",
  "product.currency",
  "variant.sku",
  "variant.barcode",
  "variant.attributes",
]);

/**
 * Custom labels for field display.
 * Overrides the default labels from the connector schema.
 */
export const FIELD_UI_LABELS: Record<string, { label: string; description: string }> = {
  // Product
  "product.name": {
    label: "Title",
    description: "Product title in your Shopify store, will be publicly visible",
  },
  "product.description": {
    label: "Description",
    description: "Product description in your Shopify store, will be publicly visible",
  },
  "product.imagePath": {
    label: "Image",
    description: "Main product image from your Shopify store, will be publicly visible",
  },
  // Variants
  "variant.attributes": {
    label: "Attributes",
    description: "Variant options from your Shopify store (Color, Size, etc.), will be publicly visible",
  },
  "variant.sku": {
    label: "SKUs",
    description: "Variant-level SKUs, used to identify and enrich products",
  },
  "variant.barcode": {
    label: "Barcodes",
    description: "Variant-level barcodes, used to identify and enrich products",
  },
  // Organization
  "product.categoryId": {
    label: "Category",
    description: "Shopify's category mapped to our category system, will be publicly visible",
  },
  "product.tags": {
    label: "Tags",
    description: "Tags from your Shopify organization",
  },
  // Sales
  "product.webshopUrl": {
    label: "Webshop link",
    description: "Link to your Shopify product page, used for the product carousel",
  },
  "product.price": {
    label: "Price",
    description: "Price from your Shopify store in your main currency, used for the product carousel",
  },
};

// =============================================================================
// Functions
// =============================================================================

/**
 * Map field keys to their UI groups for display.
 * 
 * Grouping:
 * - product: Title, Description, Image
 * - variants: Attributes, SKUs, Barcodes
 * - organization: Category, Tags
 * - sales: Webshop link, Price
 */
export function getFieldGroup(fieldKey: string): FieldGroup {
  // Product fields
  if (fieldKey === "product.name") return "product";
  if (fieldKey === "product.description") return "product";
  if (fieldKey === "product.imagePath") return "product";

  // Variant fields
  if (fieldKey === "variant.attributes") return "variants";
  if (fieldKey === "variant.sku") return "variants";
  if (fieldKey === "variant.barcode") return "variants";

  // Organization fields
  if (fieldKey === "product.categoryId") return "organization";
  if (fieldKey === "product.tags") return "organization";

  // Sales fields
  if (fieldKey === "product.webshopUrl") return "sales";
  if (fieldKey === "product.price") return "sales";
  if (fieldKey === "product.currency") return "sales";
  if (fieldKey === "product.salesStatus") return "sales";

  // Default to product for any unmapped fields
  return "product";
}

/**
 * Get UI label and description for a field.
 * Falls back to the connector schema values if not overridden.
 */
export function getFieldUIInfo(field: ConnectorFieldMeta): { label: string; description: string } {
  return FIELD_UI_LABELS[field.fieldKey] ?? {
    label: field.label,
    description: field.description,
  };
}
