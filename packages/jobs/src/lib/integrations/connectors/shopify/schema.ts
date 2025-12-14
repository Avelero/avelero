/**
 * Shopify Connector Schema
 *
 * Defines the complete field mapping from Shopify GraphQL Admin API to Avelero.
 *
 * ARCHITECTURE:
 * - Primary sync entity: ProductVariant (via `productVariants` GraphQL query)
 * - Variants contain identifiers (SKU, barcode) which are the matching fields
 * - Product data is nested within each variant response
 * - Colors and sizes are extracted from `selectedOptions` array
 *
 * Shopify API Reference:
 * - productVariants query: https://shopify.dev/docs/api/admin-graphql/latest/queries/productvariants
 * - SelectedOption object: https://shopify.dev/docs/api/admin-graphql/latest/objects/SelectedOption
 *
 * @see plan-integration.md Section 5.4 for architecture details
 */

import type { ConnectorSchema, ExtractContext } from "../types";

// =============================================================================
// TRANSFORM HELPERS
// =============================================================================

/**
 * Extract color value from Shopify selectedOptions array.
 * Looks for options named "Color", "Colour", "Kleur", etc.
 */
function extractColorFromOptions(
  selectedOptions: Array<{ name: string; value: string }> | undefined,
): string | null {
  if (!selectedOptions || !Array.isArray(selectedOptions)) return null;

  const colorOption = selectedOptions.find((opt) => {
    const name = opt.name?.toLowerCase();
    return (
      name === "color" ||
      name === "colour" ||
      name === "kleur" || // Dutch
      name === "farbe" || // German
      name === "couleur" // French
    );
  });

  return colorOption?.value ?? null;
}

/**
 * Extract size value from Shopify selectedOptions array.
 * Looks for options named "Size", "Taille", "Maat", etc.
 */
function extractSizeFromOptions(
  selectedOptions: Array<{ name: string; value: string }> | undefined,
): string | null {
  if (!selectedOptions || !Array.isArray(selectedOptions)) return null;

  const sizeOption = selectedOptions.find((opt) => {
    const name = opt.name?.toLowerCase();
    return (
      name === "size" ||
      name === "taille" || // French
      name === "maat" || // Dutch
      name === "größe" || // German
      name === "grootte" // Dutch alternative
    );
  });

  return sizeOption?.value ?? null;
}

/**
 * Transform Shopify product status to Avelero status.
 * Shopify: ACTIVE, DRAFT, ARCHIVED
 * Avelero: published, unpublished, archived
 */
function transformStatus(status: unknown): string {
  const s = String(status).toUpperCase();
  if (s === "ACTIVE") return "published";
  if (s === "DRAFT") return "unpublished";
  if (s === "ARCHIVED") return "archived";
  return "unpublished";
}

/**
 * Extract numeric ID from Shopify GID.
 * Example: "gid://shopify/Product/123456" → "123456"
 */
function extractShopifyId(gid: unknown): string | null {
  if (!gid || typeof gid !== "string") return null;
  const match = gid.match(/\/(\d+)$/);
  return match?.[1] ?? null;
}

/**
 * Safely parse a price value to number.
 */
function parsePrice(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number.parseFloat(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Truncate string to max length.
 */
function truncate(value: unknown, maxLength: number): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str.length > maxLength ? str.slice(0, maxLength) : str;
}

/**
 * Clean HTML tags from description (basic).
 */
function stripHtml(html: unknown): string | null {
  if (!html || typeof html !== "string") return null;
  return html.replace(/<[^>]*>/g, "").trim();
}

// =============================================================================
// SHOPIFY SCHEMA
// =============================================================================

export const shopifySchema: ConnectorSchema = {
  slug: "shopify",
  name: "Shopify",
  description:
    "E-commerce platform for online stores. Syncs product variants with SKU, barcode, color, size, and product information.",
  authType: "oauth",

  // ===========================================================================
  // ENTITIES
  // ===========================================================================

  entities: {
    /**
     * PRIMARY SYNC ENTITY: Product Variant
     *
     * Shopify stores identifiers (SKU, barcode) at the variant level.
     * We use the `productVariants` GraphQL query to fetch data.
     * Each variant includes its parent product data.
     *
     * NOTE: Only SKU and barcode are used for matching - Shopify doesn't
     * provide separate EAN/GTIN fields.
     */
    variant: {
      table: "product_variants",
      identifiedBy: ["sku", "barcode"],
      primaryIdentifier: "sku",
    },

    /**
     * SECONDARY ENTITY: Product
     *
     * Products are found/created through variants.
     * When we sync a variant, we first ensure its parent product exists.
     * Products are identified by their handle (productHandle).
     */
    product: {
      table: "products",
      identifiedBy: "productHandle",
      linkedThrough: "variant",
    },

    /**
     * REFERENCE ENTITY: Color
     *
     * Extracted from variant selectedOptions.
     * Matched by name in brand_colors table, created if not found.
     */
    color: {
      table: "brand_colors",
      identifiedBy: "name",
      syncMode: "upsert-on-reference",
    },

    /**
     * REFERENCE ENTITY: Size
     *
     * Extracted from variant selectedOptions.
     * Matched by name in brand_sizes table, created if not found.
     */
    size: {
      table: "brand_sizes",
      identifiedBy: "name",
      syncMode: "upsert-on-reference",
    },

    /**
     * REFERENCE ENTITY: Tag
     *
     * Extracted from product tags array.
     * Matched by name in brand_tags table, created if not found.
     * Many-to-many relationship via tags_on_product.
     */
    tag: {
      table: "brand_tags",
      identifiedBy: "name",
      syncMode: "upsert-on-reference",
    },

    // NOTE: Category sync is not yet implemented.
    // Categories are system-level (not brand-scoped) and require manual mapping.
    // This will be added in a future update with a category mapping feature.
  },

  // ===========================================================================
  // FIELD DEFINITIONS
  // ===========================================================================

  fields: {
    // =========================================================================
    // VARIANT-LEVEL FIELDS (Primary sync target)
    // =========================================================================

    /**
     * SKU - Stock Keeping Unit
     * PRIMARY identifier for matching variants.
     *
     * Shopify path: sku (direct field on ProductVariant)
     */
    "variant.sku": {
      targetField: "variant.sku",
      entity: "variant",
      description:
        "Stock Keeping Unit - primary identifier for matching variants",
      sourceOptions: [
        {
          key: "sku",
          label: "Variant SKU",
          path: "sku",
        },
      ],
      defaultSource: "sku",
      transform: (v) => truncate(v, 255),
    },

    /**
     * Barcode
     * Secondary identifier for matching variants.
     *
     * Shopify path: barcode (direct field on ProductVariant)
     */
    "variant.barcode": {
      targetField: "variant.barcode",
      entity: "variant",
      description: "Barcode - secondary identifier for matching variants",
      sourceOptions: [
        {
          key: "barcode",
          label: "Variant Barcode",
          path: "barcode",
        },
      ],
      defaultSource: "barcode",
      transform: (v) => truncate(v, 255),
    },

    // NOTE: EAN and GTIN are NOT synced from Shopify.
    // Shopify only provides SKU and barcode as variant identifiers.
    // EAN/GTIN should be managed separately if needed.

    /**
     * Color
     * Extracted from variant selectedOptions array.
     *
     * Shopify stores color as a custom option like:
     * { name: "Color", value: "Blue" }
     *
     * We extract the value and match it against brand_colors by name.
     * If not found, a new color is created.
     */
    "variant.colorId": {
      targetField: "variant.colorId",
      entity: "variant",
      description: "Color extracted from Shopify variant options",
      referenceEntity: "color",
      sourceOptions: [
        {
          key: "color_option",
          label: "Color Option",
          path: "selectedOptions",
          transform: (opts) =>
            extractColorFromOptions(
              opts as Array<{ name: string; value: string }>,
            ),
        },
      ],
      defaultSource: "color_option",
    },

    /**
     * Size
     * Extracted from variant selectedOptions array.
     *
     * Shopify stores size as a custom option like:
     * { name: "Size", value: "M" }
     *
     * We extract the value and match it against brand_sizes by name.
     * If not found, a new size is created.
     */
    "variant.sizeId": {
      targetField: "variant.sizeId",
      entity: "variant",
      description: "Size extracted from Shopify variant options",
      referenceEntity: "size",
      sourceOptions: [
        {
          key: "size_option",
          label: "Size Option",
          path: "selectedOptions",
          transform: (opts) =>
            extractSizeFromOptions(
              opts as Array<{ name: string; value: string }>,
            ),
        },
      ],
      defaultSource: "size_option",
    },

    // =========================================================================
    // PRODUCT-LEVEL FIELDS (Synced via variant's parent product)
    // =========================================================================

    /**
     * Product Name
     *
     * Shopify path: product.title
     */
    "product.name": {
      targetField: "product.name",
      entity: "product",
      description: "Product display name from Shopify",
      sourceOptions: [
        {
          key: "title",
          label: "Product Title",
          path: "product.title",
        },
      ],
      defaultSource: "title",
      transform: (v) => truncate(v, 255),
    },

    // NOTE: productHandle is NOT synced from Shopify.
    // The handle is auto-generated from the product title (with uniqueness)
    // and used for DPP QR codes, so it must remain stable.
    // Products are matched via variant identifiers (SKU, barcode), not handle.

    /**
     * Description
     *
     * Shopify has both HTML and plain text descriptions.
     */
    "product.description": {
      targetField: "product.description",
      entity: "product",
      description: "Product description text",
      sourceOptions: [
        {
          key: "description",
          label: "Plain Text Description",
          path: "product.description",
        },
        {
          key: "descriptionHtml",
          label: "HTML Description (stripped)",
          path: "product.descriptionHtml",
          transform: stripHtml,
        },
      ],
      defaultSource: "description",
      transform: (v) => truncate(v, 5000),
    },

    /**
     * Primary Image
     *
     * Can come from variant image or product featured image.
     * Variant image takes precedence if available.
     */
    "product.primaryImagePath": {
      targetField: "product.primaryImagePath",
      entity: "product",
      description: "Product image URL",
      sourceOptions: [
        {
          key: "product_featured_image",
          label: "Product Featured Image",
          path: "product.featuredImage.url",
        },
        {
          key: "variant_image",
          label: "Variant Image (if available)",
          path: "image.url",
        },
      ],
      defaultSource: "product_featured_image",
    },

    /**
     * Webshop URL
     *
     * Online store URL for the product.
     */
    "product.webshopUrl": {
      targetField: "product.webshopUrl",
      entity: "product",
      description: "URL to the product on the online store",
      sourceOptions: [
        {
          key: "online_store_url",
          label: "Online Store URL",
          path: "product.onlineStoreUrl",
        },
      ],
      defaultSource: "online_store_url",
    },

    /**
     * Price
     *
     * Can come from variant price or product price range.
     * Variant price is more accurate for specific variants.
     */
    "product.price": {
      targetField: "product.price",
      entity: "product",
      description: "Product price",
      sourceOptions: [
        {
          key: "variant_price",
          label: "Variant Price",
          path: "price",
        },
        {
          key: "compare_at_price",
          label: "Compare-at Price (original price)",
          path: "compareAtPrice",
        },
      ],
      defaultSource: "variant_price",
      transform: parsePrice,
    },

    /**
     * Currency
     *
     * Shopify stores currency at the shop level, but we can get it from price context.
     * For now, we'll let this be configured manually or extracted from shop settings.
     *
     * Note: This field may need enhancement when we implement shop settings fetching.
     */
    "product.currency": {
      targetField: "product.currency",
      entity: "product",
      description: "Currency code (e.g., EUR, USD)",
      sourceOptions: [
        {
          key: "shop_currency",
          label: "Shop Default Currency",
          path: "product.priceRangeV2.minVariantPrice.currencyCode",
        },
      ],
      defaultSource: "shop_currency",
      transform: (v) => (v ? String(v).toUpperCase() : null),
    },

    /**
     * Sales Status
     *
     * Determines if product should appear in carousels and other showcases.
     * Derived from Shopify's product status.
     *
     * Shopify status: ACTIVE, DRAFT, ARCHIVED
     * Avelero salesStatus: active, inactive, discontinued
     */
    "product.salesStatus": {
      targetField: "product.salesStatus",
      entity: "product",
      description:
        "Sales status - determines carousel inclusion and product visibility",
      sourceOptions: [
        {
          key: "from_status",
          label: "Derived from Shopify Status",
          path: "product.status",
          transform: (status) => {
            const s = String(status).toUpperCase();
            if (s === "ACTIVE") return "active";
            if (s === "DRAFT") return "inactive";
            if (s === "ARCHIVED") return "discontinued";
            return "inactive";
          },
        },
      ],
      defaultSource: "from_status",
    },

    // NOTE: product.categoryId is not yet implemented.
    // Categories are system-level (not brand-scoped) and require a mapping feature.
    // Shopify categories (from Standard Product Taxonomy) don't map 1:1 to Avelero categories.
    // This will be added in a future update.

    // =========================================================================
    // RELATION FIELDS
    // =========================================================================

    /**
     * Tags
     *
     * Shopify tags are stored as an array of strings.
     * We sync them to brand_tags and link via tags_on_product junction table.
     */
    "product.tags": {
      targetField: "product.tags",
      entity: "product",
      description: "Product tags (synced as brand tags)",
      isRelation: true,
      relationType: "tags",
      sourceOptions: [
        {
          key: "tags",
          label: "Product Tags",
          path: "product.tags",
          transform: (tags) => {
            if (!tags || !Array.isArray(tags)) return [];
            // Filter out empty strings and normalize
            return tags
              .map((t) => String(t).trim())
              .filter((t) => t.length > 0);
          },
        },
      ],
      defaultSource: "tags",
    },
  },
};

// =============================================================================
// GRAPHQL QUERY
// =============================================================================

/**
 * GraphQL query for fetching product variants with all required fields.
 *
 * This query:
 * - Uses productVariants query (not products) for variant-level sync
 * - Includes parent product data nested in each variant
 * - Supports pagination with cursor-based navigation
 * - Requests only fields we actually map
 */
export const SHOPIFY_PRODUCT_VARIANTS_QUERY = `
  query GetProductVariants($first: Int!, $after: String) {
    productVariants(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          # Variant identifiers (for matching)
          id
          sku
          barcode
          
          # Variant attributes
          title
          price
          compareAtPrice
          
          # Variant options (for color/size extraction)
          selectedOptions {
            name
            value
          }
          
          # Variant image (optional)
          image {
            url
          }
          
          # Parent product data
          product {
            id
            title
            handle
            description
            descriptionHtml
            status
            productType
            vendor
            tags
            onlineStoreUrl
            
            # Category from Shopify Standard Product Taxonomy
            category {
              id
              name
              fullName
            }
            
            # Product images
            featuredImage {
              url
            }
            
            # Price info
            priceRangeV2 {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  }
`;

/**
 * Default batch size for fetching variants.
 * Shopify allows up to 250 per request.
 */
export const SHOPIFY_BATCH_SIZE = 100;
