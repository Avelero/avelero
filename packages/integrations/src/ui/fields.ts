/**
 * Connector Field Definitions (Client-Safe)
 *
 * This file exports field metadata for each connector that can be safely
 * used on both client and server. It derives data from connector schemas.
 *
 * Transform functions are NOT included as they cannot be serialized.
 *
 * @see packages/integrations/src/connectors/shopify/schema.ts
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Categories for grouping fields in UI.
 * 
 * Grouping:
 * - product: Title, description, image
 * - organization: Tags, categories
 * - sales: Webshop URL, price, currency, status
 * 
 * NOTE: Variant fields (SKU, barcode, attributes) are NOT configurable.
 * They are always synced as structural fields.
 */
export type FieldCategory =
  | "product"
  | "organization"
  | "sales";

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

/**
 * Category labels for UI display.
 */
export const FIELD_CATEGORY_LABELS = {
  product: "Product",
  organization: "Organization",
  sales: "Sales",
} satisfies Record<FieldCategory, string>;

// =============================================================================
// SHOPIFY FIELDS
// =============================================================================

/**
 * Shopify field definitions with metadata.
 *
 * NOTE: EAN and GTIN are NOT included - Shopify only syncs SKU and barcode.
 * NOTE: productHandle is NOT included - it's auto-generated from product title
 *       and used for DPP QR codes, so it must remain stable.
 */
const SHOPIFY_FIELD_DEFINITIONS: Array<{
  fieldKey: string;
  label: string;
  description: string;
  entity: "product" | "variant";
  category: FieldCategory;
  required: boolean;
}> = [
    // ─────────────────────────────────────────────────────────────────────────────
    // PRODUCT FIELDS
    // ─────────────────────────────────────────────────────────────────────────────
    {
      fieldKey: "product.name",
      label: "Product Name",
      description: "Product display name from Shopify",
      entity: "product",
      category: "product",
      required: false,
    },
    {
      fieldKey: "product.description",
      label: "Description",
      description: "Product description text from Shopify",
      entity: "product",
      category: "product",
      required: false,
    },
    {
      fieldKey: "product.imagePath",
      label: "Primary Image",
      description: "Product image URL from Shopify",
      entity: "product",
      category: "product",
      required: false,
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // VARIANT FIELDS
    // ─────────────────────────────────────────────────────────────────────────────
    // NOTE: variant.attributes, variant.sku, and variant.barcode are NOT included here.
    // These are structural fields that are ALWAYS synced:
    // - SKU and barcode are used for matching variants
    // - Attributes define variant structure (primary integrations only)
    // Users cannot disable these fields.
    //
    // For secondary integrations, match identifier (barcode vs SKU) is configured
    // via brand_integrations.match_identifier, not here.

    // ─────────────────────────────────────────────────────────────────────────────
    // ORGANIZATION FIELDS
    // ─────────────────────────────────────────────────────────────────────────────
    {
      fieldKey: "product.tags",
      label: "Tags",
      description: "Product tags synced as brand tags",
      entity: "product",
      category: "organization",
      required: false,
    },
    {
      fieldKey: "product.categoryId",
      label: "Category",
      description: "Product category from Shopify taxonomy",
      entity: "product",
      category: "organization",
      required: false,
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // SALES FIELDS
    // ─────────────────────────────────────────────────────────────────────────────
    {
      fieldKey: "product.webshopUrl",
      label: "Webshop URL",
      description: "URL to the product on the online store",
      entity: "product",
      category: "sales",
      required: false,
    },
    {
      fieldKey: "product.price",
      label: "Price",
      description: "Product price from variant",
      entity: "product",
      category: "sales",
      required: false,
    },
    {
      fieldKey: "product.currency",
      label: "Currency",
      description: "Currency code from Shopify shop settings",
      entity: "product",
      category: "sales",
      required: false,
    },
    {
      fieldKey: "product.salesStatus",
      label: "Sales Status",
      description: "Availability status derived from Shopify product status",
      entity: "product",
      category: "sales",
      required: false,
    },
  ];

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Shopify connector field metadata.
 * Use this for the field setup wizard.
 */
export const SHOPIFY_FIELDS: readonly ConnectorFieldMeta[] = SHOPIFY_FIELD_DEFINITIONS;

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
