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

import type { ConnectorSchema } from "../types.ts";
import type { ShopifySelectedOption, ShopifyProductOption } from "./types.ts";
import {
  extractColorFromOptions,
  extractSizeFromOptions,
  parseShopifyPrice,
  stripHtmlTags,
  transformSalesStatus,
  transformTags,
  truncateString,
} from "./mappings";
import { resolveShopifyCategoryId } from "./category-mappings";

/**
 * Type for the full variant node with nested product data.
 * Used for extracting color/size with access to product.options.
 */
interface ShopifyVariantWithProduct {
  selectedOptions: ShopifySelectedOption[];
  product: {
    options: ShopifyProductOption[] | null;
  };
}

/**
 * Type for Shopify category object from GraphQL response.
 */
interface ShopifyCategory {
  id: string;
  name: string;
  fullName: string;
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

    /**
     * REFERENCE ENTITY: Category
     *
     * Mapped from Shopify Standard Product Taxonomy to Avelero categories.
     * Categories are system-level (not brand-scoped) - they're matched by
     * parent + name combination and must already exist in the database.
     *
     * Uses a hierarchical mapping system defined in category-mappings.ts
     * that maps ~6000 Shopify taxonomy IDs to ~150 Avelero categories.
     *
     * NOTE: No syncMode = match only (categories are global, never auto-created).
     * The sync logic should look up by name and skip if not found.
     */
    category: {
      table: "categories",
      identifiedBy: ["parentName", "name"],
      // No syncMode means "match only" - categories must exist, don't auto-create
    },
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
     */
    "variant.sku": {
      targetField: "variant.sku",
      entity: "variant",
      description: "Stock Keeping Unit - primary identifier for matching variants",
      sourceOptions: [
        {
          key: "sku",
          label: "Variant SKU",
          path: "sku",
        },
      ],
      defaultSource: "sku",
      transform: (v) => truncateString(v, 255),
    },

    /**
     * Barcode
     * Secondary identifier for matching variants.
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
      transform: (v) => truncateString(v, 255),
    },

    /**
     * Color
     * Extracted from variant selectedOptions array.
     * Now includes hex value from product.options[].optionValues[].swatch.color.
     */
    "variant.colorId": {
      targetField: "variant.colorId",
      entity: "variant",
      description: "Color extracted from Shopify variant options (includes hex from swatch)",
      referenceEntity: "color",
      sourceOptions: [
        {
          key: "color_option",
          label: "Color Option",
          path: ".", // Root path to access both selectedOptions and product.options
          transform: (variant) => {
            const v = variant as ShopifyVariantWithProduct;
            return extractColorFromOptions(v.selectedOptions, v.product?.options);
          },
        },
      ],
      defaultSource: "color_option",
    },

    /**
     * Size
     * Extracted from variant selectedOptions array.
     * Ordering is handled at product level via sizeOrder array.
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
          path: ".", // Root path to access both selectedOptions and product.options
          transform: (variant) => {
            const v = variant as ShopifyVariantWithProduct;
            return extractSizeFromOptions(v.selectedOptions, v.product?.options);
          },
        },
      ],
      defaultSource: "size_option",
    },

    // =========================================================================
    // PRODUCT-LEVEL FIELDS (Synced via variant's parent product)
    // =========================================================================

    /**
     * Product Name
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
      transform: (v) => truncateString(v, 255),
    },

    /**
     * Description
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
          transform: stripHtmlTags,
        },
      ],
      defaultSource: "description",
      transform: (v) => truncateString(v, 5000),
    },

    /**
     * Primary Image
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
     * Uses priceRangeV2.minVariantPrice.amount for consistency with currency source.
     * Both price and currency come from the same priceRangeV2 object.
     */
    "product.price": {
      targetField: "product.price",
      entity: "product",
      description: "Product price from price range",
      sourceOptions: [
        {
          key: "price_range_min",
          label: "Price Range (Min Variant Price)",
          path: "product.priceRangeV2.minVariantPrice.amount",
        },
        {
          key: "variant_price",
          label: "Variant Price (direct)",
          path: "price",
        },
        {
          key: "compare_at_price",
          label: "Compare-at Price (original price)",
          path: "compareAtPrice",
        },
      ],
      defaultSource: "price_range_min",
      transform: parseShopifyPrice,
    },

    /**
     * Currency
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
     */
    "product.salesStatus": {
      targetField: "product.salesStatus",
      entity: "product",
      description: "Sales status - determines carousel inclusion and product visibility",
      sourceOptions: [
        {
          key: "from_status",
          label: "Derived from Shopify Status",
          path: "product.status",
          transform: transformSalesStatus,
        },
      ],
      defaultSource: "from_status",
    },

    // =========================================================================
    // RELATION FIELDS
    // =========================================================================

    /**
     * Tags
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
          transform: transformTags,
        },
      ],
      defaultSource: "tags",
    },

    /**
     * Category
     *
     * Maps Shopify Standard Product Taxonomy to Avelero categories.
     * Uses a comprehensive mapping system that covers all ~6000 Shopify
     * apparel categories via branch defaults and specific overrides.
     *
     * The transform returns the Avelero category UUID directly,
     * resolved from the Shopify taxonomy ID using the mapping tables.
     */
    "product.categoryId": {
      targetField: "product.categoryId",
      entity: "product",
      description: "Product category mapped from Shopify taxonomy",
      referenceEntity: "category",
      sourceOptions: [
        {
          key: "shopify_category",
          label: "Shopify Category",
          path: "product.category",
          transform: (category) =>
            resolveShopifyCategoryId(category as ShopifyCategory | null),
        },
      ],
      defaultSource: "shopify_category",
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
            
            # Product options with linked metafields and swatches
            # Used to identify option types (color vs size) and extract hex values
            options {
              id
              name
              position
              linkedMetafield {
                namespace
                key
              }
              optionValues {
                id
                name
                linkedMetafieldValue
                swatch {
                  color
                }
              }
            }
          }
        }
      }
    }
  }
`;
