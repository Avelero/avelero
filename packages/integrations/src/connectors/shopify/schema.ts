/**
 * Shopify Connector Schema
 *
 * Product-centric sync: products are the primary entity with nested variants.
 */

import type { ConnectorSchema } from "../types.ts";
import {
  parseShopifyPrice,
  stripHtmlTags,
  transformSalesStatus,
  transformTags,
  truncateString,
} from "./mappings";
import { resolveShopifyCategoryId } from "./category-mappings";

interface ShopifyCategory {
  id: string;
  name: string;
  fullName: string;
}

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
      sourceOptions: [{ key: "sku", label: "SKU", path: "sku" }],
      defaultSource: "sku",
      transform: (v) => truncateString(v, 255),
    },

    "variant.barcode": {
      targetField: "variant.barcode",
      entity: "variant",
      description: "Barcode",
      sourceOptions: [{ key: "barcode", label: "Barcode", path: "barcode" }],
      defaultSource: "barcode",
      transform: (v) => truncateString(v, 255),
    },

    "variant.attributes": {
      targetField: "variant.attributes",
      entity: "variant",
      description: "Variant attributes (Color, Size, Age group, etc.)",
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
      transform: (v) => truncateString(v, 255),
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
      transform: (v) => truncateString(v, 5000),
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
      transform: (v) => (v ? String(v).toUpperCase() : null),
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
          transform: (cat) => resolveShopifyCategoryId(cat as ShopifyCategory | null),
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
