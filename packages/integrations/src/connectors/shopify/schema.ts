/**
 * Shopify Connector Schema
 *
 * Product-centric sync: products are the primary entity with nested variants.
 * Includes field transforms and option parsing logic.
 */

import type { ConnectorSchema } from "../../types";
import { resolveShopifyCategoryId } from "./category-mappings";

// =============================================================================
// SHOPIFY CATEGORY TYPE
// =============================================================================

interface ShopifyCategory {
  id: string;
  name: string;
  fullName: string;
}

// =============================================================================
// TRANSFORM FUNCTIONS
// =============================================================================

/**
 * Transform Shopify product status to Avelero sales status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: active, inactive, discontinued
 */
export function transformSalesStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "DRAFT") return "inactive";
  if (s === "ARCHIVED") return "discontinued";
  return "inactive";
}

/**
 * Safely parse a price value to number.
 */
export function parseShopifyPrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Truncate string to max length.
 */
export function truncateString(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Clean HTML tags from description (basic).
 */
export function stripHtmlTags(html: unknown): string | null {
  if (!html || typeof html !== "string") return null;
  return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Transform Shopify tags to normalized strings.
 * 
 * Handles two possible formats from Shopify:
 * - GraphQL Admin API: Array of strings ["summer", "sports"]
 * - String format: Comma-separated "summer, sports"
 * 
 * The GraphQL API should return an array, but we handle both for robustness.
 */
export function transformTags(tags: unknown): string[] {
  if (!tags) return [];

  // Handle array format (expected from GraphQL API)
  if (Array.isArray(tags)) {
    return tags
      .map((t) => String(t).trim())
      .filter((t) => t.length > 0);
  }

  // Handle comma-separated string format (defensive handling)
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  return [];
}

// =============================================================================
// SHOPIFY OPTION PARSING (for variant attributes)
// =============================================================================

/**
 * Shopify standard metafield keys and their corresponding taxonomy friendly_ids.
 * Used to determine taxonomy linking for brand attributes.
 *
 * We ONLY use metafield mapping (not name-based fallback) because:
 * 1. If a merchant has configured linkedMetafield in Shopify, they've explicitly
 *    defined the semantic meaning - we should respect that.
 * 2. If there's no linkedMetafield, the attribute has no semantic meaning in
 *    Shopify either - it's just a string label. We should treat it the same.
 * 3. Name-based fallback is brittle: "colors" vs "color", translations like
 *    "kleur" or "Farbe", and false positives from unrelated terms.
 *
 * Reference: Shopify Standard Product Taxonomy Category Metafields
 * https://shopify.dev/docs/apps/build/graphql/migrate/new-product-model/metafields
 */
const SHOPIFY_METAFIELD_TO_TAXONOMY: Record<string, string> = {
  // Core attributes available across most categories
  "color-pattern": "color",
  "size": "size",
  "target-gender": "target_gender",
  "age-group": "age_group",
  "fabric": "fabric",
};

/**
 * Get a value from a nested object using dot notation path.
 * Use "." as path to return the root object.
 */
function getValueByPath(obj: Record<string, unknown>, path: string): unknown {
  // Special case: "." returns the root object
  if (path === ".") return obj;

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Resolves the taxonomy attribute friendly_id from a Shopify option.
 *
 * ONLY uses linkedMetafield.key for matching - no name-based fallback.
 *
 * If a merchant has configured their Shopify product options with standard
 * category metafields (e.g., linkedMetafield.key = "color-pattern"), we map
 * that to our taxonomy. If they haven't, the attribute has no semantic meaning
 * in Shopify either, so we don't assign one.
 *
 * @returns taxonomy friendly_id (e.g. "color", "size") or null if no mapping found
 */
export function resolveTaxonomyFriendlyId(
  optionName: string,
  variantData: Record<string, unknown>,
): string | null {
  const name = optionName.trim();
  if (!name) return null;

  // Check if this option has a linkedMetafield that tells us the semantic type
  const productOptions = getValueByPath(variantData, "product.options");
  if (!Array.isArray(productOptions)) return null;

  const match = productOptions.find((opt) => {
    if (typeof opt !== "object" || opt === null) return false;
    const optName = (opt as Record<string, unknown>).name;
    return typeof optName === "string" && optName.trim().toLowerCase() === name.toLowerCase();
  }) as Record<string, unknown> | undefined;

  const linked = match?.linkedMetafield;
  if (!linked || typeof linked !== "object") return null;

  const ns = (linked as Record<string, unknown>).namespace;
  const key = (linked as Record<string, unknown>).key;

  // Only match Shopify standard metafields (namespace = "shopify")
  if (ns !== "shopify" || typeof key !== "string" || key.trim().length === 0) {
    return null;
  }

  const metafieldKey = key.trim().toLowerCase();
  return SHOPIFY_METAFIELD_TO_TAXONOMY[metafieldKey] ?? null;
}

/**
 * Normalizes an option name for display.
 * Keeps the original name but trims whitespace.
 * We preserve the merchant's chosen name (e.g. "kleur" stays "kleur").
 */
function normalizeOptionName(name: string): string {
  return name.trim();
}

/**
 * Parsed variant option with optional taxonomy hint.
 */
export interface ParsedVariantOption {
  name: string;
  value: string;
  /** Taxonomy friendly_id if resolvable (e.g. "color", "size") */
  taxonomyFriendlyId: string | null;
}

/**
 * Parse Shopify selectedOptions from variant data.
 * Normalizes, filters empty values, and drops "Title=Default Title".
 * Also resolves taxonomy hints for each option.
 */
export function parseSelectedOptions(
  variantData: Record<string, unknown>
): ParsedVariantOption[] {
  const selectedOptions = getValueByPath(variantData, "selectedOptions");
  if (!Array.isArray(selectedOptions)) return [];

  const result: ParsedVariantOption[] = [];

  for (const opt of selectedOptions) {
    if (
      typeof opt !== "object" ||
      opt === null ||
      typeof (opt as Record<string, unknown>).name !== "string" ||
      typeof (opt as Record<string, unknown>).value !== "string"
    ) {
      continue;
    }

    const name = ((opt as Record<string, unknown>).name as string).trim();
    const value = ((opt as Record<string, unknown>).value as string).trim();

    // Skip empty values
    if (!name || !value) continue;

    // Skip "Title = Default Title" (Shopify's placeholder for single-variant products)
    if (name === "Title" && value === "Default Title") continue;

    const normalizedName = normalizeOptionName(name);
    const taxonomyFriendlyId = resolveTaxonomyFriendlyId(name, variantData);
    result.push({ name: normalizedName, value, taxonomyFriendlyId });
  }

  return result;
}

// =============================================================================
// CONNECTOR SCHEMA
// =============================================================================

export const shopifySchema: ConnectorSchema = {
  slug: "shopify",
  name: "Shopify",
  description: "E-commerce platform. Syncs products with variants and tags.",
  authType: "oauth",

  entities: {
    variant: {
      table: "product_variants",
      identifiedBy: ["sku", "barcode"],
      primaryIdentifier: "sku",
    },
    product: {
      table: "products",
      identifiedBy: "productHandle",
      linkedThrough: "variant",
    },
    tag: {
      table: "brand_tags",
      identifiedBy: "name",
      syncMode: "upsert-on-reference",
    },
    category: {
      table: "categories",
      identifiedBy: ["parentName", "name"],
    },
  },

  fields: {
    // VARIANT FIELDS - extracted from variant data with product context
    "variant.sku": {
      targetField: "variant.sku",
      entity: "variant",
      description: "Stock Keeping Unit",
      alwaysEnabled: true,
      sourceOptions: [{ key: "sku", label: "SKU", path: "sku" }],
      defaultSource: "sku",
      transform: (v: unknown) => truncateString(v, 255),
    },

    "variant.barcode": {
      targetField: "variant.barcode",
      entity: "variant",
      description: "Barcode",
      alwaysEnabled: true,
      sourceOptions: [{ key: "barcode", label: "Barcode", path: "barcode" }],
      defaultSource: "barcode",
      transform: (v: unknown) => truncateString(v, 255),
    },

    "variant.attributes": {
      targetField: "variant.attributes",
      entity: "variant",
      description: "Variant attributes (Color, Size, Age group, etc.)",
      alwaysEnabled: true,
      sourceOptions: [
        {
          key: "selectedOptions",
          label: "Selected Options",
          path: "selectedOptions",
        },
      ],
      defaultSource: "selectedOptions",
      // No transform - processor handles normalization
    },

    // PRODUCT FIELDS - extracted directly from product data (no "product." prefix)
    "product.name": {
      targetField: "product.name",
      entity: "product",
      description: "Product name",
      sourceOptions: [{ key: "title", label: "Title", path: "title" }],
      defaultSource: "title",
      transform: (v: unknown) => truncateString(v, 255),
    },

    "product.description": {
      targetField: "product.description",
      entity: "product",
      description: "Product description",
      sourceOptions: [
        { key: "description", label: "Plain Text", path: "description" },
        { key: "descriptionHtml", label: "HTML (stripped)", path: "descriptionHtml", transform: stripHtmlTags },
      ],
      defaultSource: "description",
      transform: (v: unknown) => truncateString(v, 5000),
    },

    "product.imagePath": {
      targetField: "product.imagePath",
      entity: "product",
      description: "Product image URL",
      sourceOptions: [{ key: "featured_image", label: "Featured Image", path: "featuredImage.url" }],
      defaultSource: "featured_image",
    },

    "product.webshopUrl": {
      targetField: "product.webshopUrl",
      entity: "product",
      description: "Online store URL",
      sourceOptions: [{ key: "online_store_url", label: "URL", path: "onlineStoreUrl" }],
      defaultSource: "online_store_url",
    },

    "product.price": {
      targetField: "product.price",
      entity: "product",
      description: "Product price",
      sourceOptions: [{ key: "price", label: "Min Price", path: "priceRangeV2.minVariantPrice.amount" }],
      defaultSource: "price",
      transform: parseShopifyPrice,
    },

    "product.currency": {
      targetField: "product.currency",
      entity: "product",
      description: "Currency code",
      sourceOptions: [{ key: "currency", label: "Currency", path: "priceRangeV2.minVariantPrice.currencyCode" }],
      defaultSource: "currency",
      transform: (v: unknown) => (v ? String(v).toUpperCase() : null),
    },

    "product.salesStatus": {
      targetField: "product.salesStatus",
      entity: "product",
      description: "Sales status",
      sourceOptions: [{ key: "status", label: "Status", path: "status", transform: transformSalesStatus }],
      defaultSource: "status",
    },

    "product.tags": {
      targetField: "product.tags",
      entity: "product",
      description: "Product tags",
      isRelation: true,
      relationType: "tags",
      sourceOptions: [{ key: "tags", label: "Tags", path: "tags", transform: transformTags }],
      defaultSource: "tags",
    },

    "product.categoryId": {
      targetField: "product.categoryId",
      entity: "product",
      description: "Category from Shopify taxonomy",
      referenceEntity: "category",
      sourceOptions: [
        {
          key: "category",
          label: "Category",
          path: "category",
          transform: (cat: unknown) => resolveShopifyCategoryId(cat as ShopifyCategory | null),
        },
      ],
      defaultSource: "category",
    },
  },
};

// GraphQL query for product-centric sync
export const SHOPIFY_PRODUCTS_QUERY = `
  query GetProducts($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          handle
          title
          description
          descriptionHtml
          status
          productType
          vendor
          tags
          onlineStoreUrl
          category { id name fullName }
          featuredImage { url }
          priceRangeV2 { minVariantPrice { amount currencyCode } }
          options {
            id name position
            linkedMetafield { namespace key }
            optionValues { id name linkedMetafieldValue swatch { color } }
          }
          variants(first: 250) {
            edges {
              node {
                id sku barcode title price compareAtPrice
                selectedOptions { name value }
                image { url }
              }
            }
          }
        }
      }
    }
  }
`;
