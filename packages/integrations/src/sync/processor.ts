/**
 * Variant Processor
 *
 * Handles processing a single variant from external data.
 */

import type { Database } from "@v1/db/client";
import { eq } from "@v1/db/index";
import {
  createVariantLink,
  findVariantLink,
  updateVariantLink,
} from "@v1/db/queries/integrations";
import {
  setProductTags,
} from "@v1/db/queries/products";
import { productVariants, products } from "@v1/db/schema";
import type { EffectiveFieldMapping } from "./extractor";
import { extractValues, computeHash } from "./extractor";
import {
  findOrCreateColor,
  findOrCreateSize,
  findOrCreateTag,
  findOrCreateProduct,
  findVariantByIdentifiers,
  findVariantByIdentifiersInBrand,
  generateVariantUpid,
  processImageUrl,
} from "./matcher";
import type { FetchedVariant, SyncContext } from "./types";
import type { ShopifyProductOption } from "../connectors/shopify/types";
import {
  extractProductColorOrder,
  extractProductSizeOrder,
  getColorHexFromProductOptions,
} from "../connectors/shopify/mappings";

// =============================================================================
// TYPES
// =============================================================================

export interface ProcessedVariantResult {
  success: boolean;
  variantCreated: boolean;
  variantUpdated: boolean;
  productCreated: boolean;
  productUpdated: boolean;
  productId?: string;
  entitiesCreated: number;
  error?: string;
}

/**
 * In-memory caches to avoid redundant database lookups during a sync session.
 * These are passed from the engine and shared across all variant processing.
 */
export interface SyncCaches {
  /** Cache of color name -> { id, created } */
  colors: Map<string, { id: string; created: boolean }>;
  /** Cache of size name -> { id, created } */
  sizes: Map<string, { id: string; created: boolean }>;
  /** Cache of external product ID -> { id, productHandle, created } */
  products: Map<string, { id: string; productHandle: string; created: boolean }>;
  /** Cache of tag name -> { id, created } */
  tags: Map<string, { id: string; created: boolean }>;
  /** Set of product IDs that have already been updated this sync session */
  updatedProductIds: Set<string>;
}

// =============================================================================
// PROCESSOR
// =============================================================================

/**
 * Process a single variant from external data.
 * 
 * @param db - Database connection
 * @param ctx - Sync context with credentials and configuration
 * @param externalVariant - The variant data from the external system
 * @param mappings - Field mappings to apply
 * @param caches - In-memory caches to avoid redundant lookups
 */
export async function processVariant(
  db: Database,
  ctx: SyncContext,
  externalVariant: FetchedVariant,
  mappings: EffectiveFieldMapping[],
  caches: SyncCaches
): Promise<ProcessedVariantResult> {
  let entitiesCreated = 0;
  let variantCreated = false;
  let variantUpdated = false;
  let productCreated = false;
  let productUpdated = false;

  try {
    // Extract values using field mappings
    const extracted = extractValues(externalVariant.data, mappings);
    const hash = computeHash(extracted);

    // Check for existing variant link
    const existingLink = await findVariantLink(
      db,
      ctx.brandIntegrationId,
      externalVariant.externalId
    );

    // If link exists and hash unchanged, skip
    if (existingLink?.lastSyncedHash === hash) {
      return {
        success: true,
        variantCreated: false,
        variantUpdated: false,
        productCreated: false,
        productUpdated: false,
        entitiesCreated: 0,
      };
    }

    // Handle reference entities with caching
    let colorId: string | null = null;
    let sizeId: string | null = null;

    if (extracted.referenceEntities.colorName) {
      const colorName = extracted.referenceEntities.colorName;
      const colorHex = extracted.referenceEntities.colorHex;
      
      // Check cache first
      const cachedColor = caches.colors.get(colorName);
      if (cachedColor) {
        colorId = cachedColor.id;
      } else {
        // Not in cache, fetch from DB
        // Pass Shopify hex value if available (from swatch.color)
        const color = await findOrCreateColor(db, ctx.brandId, colorName, colorHex);
        caches.colors.set(colorName, color);
        colorId = color.id;
        // Only count as created if it was actually created (first time we see this color)
        if (color.created) entitiesCreated++;
      }
    }

    if (extracted.referenceEntities.sizeName) {
      const sizeName = extracted.referenceEntities.sizeName;
      
      // Check cache first
      const cachedSize = caches.sizes.get(sizeName);
      if (cachedSize) {
        sizeId = cachedSize.id;
      } else {
        // Not in cache, fetch from DB
        const size = await findOrCreateSize(db, ctx.brandId, sizeName);
        caches.sizes.set(sizeName, size);
        sizeId = size.id;
        // Only count as created if it was actually created (first time we see this size)
        if (size.created) entitiesCreated++;
      }
    }

    // Find or create product using the product name to generate a clean handle
    const productName =
      (extracted.product.name as string) || "Unnamed Product";

    // Get category UUID from reference entities (resolved from Shopify taxonomy)
    const categoryId = extracted.referenceEntities.categoryId ?? null;

    // Extract product-level option ordering (for sizeOrder/colorOrder arrays)
    // Access product.options from the variant data structure
    const variantData = externalVariant.data as {
      product?: { options?: ShopifyProductOption[] | null };
    };
    const productOptions = variantData.product?.options ?? null;

    // Build sizeOrder array: convert size names to IDs (maintains Shopify's order)
    const sizeOrderNames = extractProductSizeOrder(productOptions);
    const sizeOrder: string[] = [];
    for (const sizeName of sizeOrderNames) {
      // Ensure size exists in cache (may have been created above)
      let size = caches.sizes.get(sizeName);
      if (!size) {
        size = await findOrCreateSize(db, ctx.brandId, sizeName);
        caches.sizes.set(sizeName, size);
        if (size.created) entitiesCreated++;
      }
      sizeOrder.push(size.id);
    }

    // Build colorOrder array: convert color names to IDs (maintains Shopify's order)
    const colorOrderNames = extractProductColorOrder(productOptions);
    const colorOrder: string[] = [];
    for (const colorName of colorOrderNames) {
      // Ensure color exists in cache (may have been created above)
      let color = caches.colors.get(colorName);
      if (!color) {
        // Get hex from product options for this color (null if no swatch)
        const colorHex = getColorHexFromProductOptions(productOptions, colorName);
        color = await findOrCreateColor(db, ctx.brandId, colorName, colorHex);
        caches.colors.set(colorName, color);
        if (color.created) entitiesCreated++;
      }
      colorOrder.push(color.id);
    }

    // Check product cache first (keyed by external product ID)
    let product = caches.products.get(externalVariant.externalProductId);
    
    // CRITICAL FIX: Before creating a new product, search for existing variants
    // across the entire brand by SKU/barcode. This prevents duplicate products
    // when importing products that already exist with matching identifiers.
    let existingVariantMatch: { variantId: string; productId: string; productHandle: string } | null = null;
    
    if (!product && !existingLink) {
      // Only search if we don't already have a product cached AND no existing link
      existingVariantMatch = await findVariantByIdentifiersInBrand(db, ctx.brandId, {
        sku: extracted.variant.sku as string | undefined,
        ean: extracted.variant.ean as string | undefined,
        gtin: extracted.variant.gtin as string | undefined,
        barcode: extracted.variant.barcode as string | undefined,
      });
      
      if (existingVariantMatch) {
        // Found an existing variant with matching identifiers!
        // Use its parent product instead of creating a new one.
        product = {
          id: existingVariantMatch.productId,
          productHandle: existingVariantMatch.productHandle,
          created: false,
        };
        // Cache this product for future variants from the same external product
        caches.products.set(externalVariant.externalProductId, product);
      }
    }
    
    if (!product) {
      // Not in cache and no existing variant match, fetch/create from DB
      product = await findOrCreateProduct(
        db,
        ctx.storageClient,
        ctx.brandId,
        productName,
        extracted.product,
        externalVariant.externalProductId,
        ctx.brandIntegrationId,
        categoryId,
        sizeOrder,
        colorOrder
      );
      caches.products.set(externalVariant.externalProductId, product);
    }
    productCreated = product.created;

    // Update product if it already existed AND hasn't been updated this sync session
    // This prevents redundant updates (especially image downloads) for each variant
    if (!product.created && !caches.updatedProductIds.has(product.id)) {
      const updateData: Record<string, unknown> = {};

      if (extracted.product.name) {
        updateData.name = extracted.product.name;
      }
      if (extracted.product.description !== undefined) {
        updateData.description = extracted.product.description;
      }
      // Process image URL only once per product (not for every variant)
      if (extracted.product.primaryImagePath !== undefined) {
        const imagePath = await processImageUrl(
          ctx.storageClient,
          ctx.brandId,
          product.id,
          extracted.product.primaryImagePath as string | undefined
        );
        updateData.primaryImagePath = imagePath;
      }
      if (extracted.product.webshopUrl !== undefined) {
        updateData.webshopUrl = extracted.product.webshopUrl;
      }
      if (extracted.product.price !== undefined) {
        updateData.price = extracted.product.price;
      }
      if (extracted.product.currency !== undefined) {
        updateData.currency = extracted.product.currency;
      }
      if (extracted.product.salesStatus !== undefined) {
        updateData.salesStatus = extracted.product.salesStatus;
      }
      // Update category if we have a mapping
      if (categoryId !== null) {
        updateData.categoryId = categoryId;
      }
      // Update sizeOrder/colorOrder if we have product options and arrays are not empty
      // Only update if arrays are non-empty (preserves user's manual ordering if set)
      if (sizeOrder.length > 0) {
        updateData.sizeOrder = sizeOrder;
      }
      if (colorOrder.length > 0) {
        updateData.colorOrder = colorOrder;
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(products)
          .set(updateData)
          .where(eq(products.id, product.id));
        productUpdated = true;
        // Mark this product as updated so we don't update it again for other variants
        caches.updatedProductIds.add(product.id);
      }
    }

    // Find or create variant
    let variantId: string | null = null;

    if (existingLink) {
      // Update existing variant
      variantId = existingLink.variantId;

      const variantUpdateData: Record<string, unknown> = {
        sku: (extracted.variant.sku as string) ?? null,
        ean: (extracted.variant.ean as string) ?? null,
        gtin: (extracted.variant.gtin as string) ?? null,
        barcode: (extracted.variant.barcode as string) ?? null,
        colorId,
        sizeId,
      };

      await db
        .update(productVariants)
        .set(variantUpdateData)
        .where(eq(productVariants.id, variantId));

      variantUpdated = true;

      // Update link
      await updateVariantLink(db, existingLink.id, {
        externalSku: (extracted.variant.sku as string) ?? null,
        externalBarcode: (extracted.variant.barcode as string) ?? null,
        lastSyncedHash: hash,
      });
    } else {
      // Check if we already found an existing variant via brand-wide search
      let existingVariant: { id: string } | null = existingVariantMatch 
        ? { id: existingVariantMatch.variantId } 
        : null;
      
      // If not found via brand-wide search, try to find within the product
      if (!existingVariant) {
        existingVariant = await findVariantByIdentifiers(db, product.id, {
          sku: extracted.variant.sku as string | undefined,
          ean: extracted.variant.ean as string | undefined,
          gtin: extracted.variant.gtin as string | undefined,
          barcode: extracted.variant.barcode as string | undefined,
        });
      }

      if (existingVariant) {
        // Update existing variant found by identifiers
        variantId = existingVariant.id;

        const variantUpdateData: Record<string, unknown> = {
          sku: (extracted.variant.sku as string) ?? null,
          ean: (extracted.variant.ean as string) ?? null,
          gtin: (extracted.variant.gtin as string) ?? null,
          barcode: (extracted.variant.barcode as string) ?? null,
          colorId,
          sizeId,
        };

        await db
          .update(productVariants)
          .set(variantUpdateData)
          .where(eq(productVariants.id, variantId));

        variantUpdated = true;
      } else {
        // Create new variant
        const variantUpid = await generateVariantUpid(db);

        const insertedRows = await db
          .insert(productVariants)
          .values({
            productId: product.id,
            sku: (extracted.variant.sku as string) ?? null,
            ean: (extracted.variant.ean as string) ?? null,
            gtin: (extracted.variant.gtin as string) ?? null,
            barcode: (extracted.variant.barcode as string) ?? null,
            colorId,
            sizeId,
            upid: variantUpid,
          })
          .returning({ id: productVariants.id });

        const created = insertedRows[0];
        if (!created) {
          throw new Error("Failed to create variant");
        }

        variantId = created.id;
        variantCreated = true;
      }

      // Create variant link
      await createVariantLink(db, {
        brandIntegrationId: ctx.brandIntegrationId,
        variantId,
        externalId: externalVariant.externalId,
        externalProductId: externalVariant.externalProductId,
        externalSku: (extracted.variant.sku as string) ?? null,
        externalBarcode: (extracted.variant.barcode as string) ?? null,
        lastSyncedHash: hash,
      });
    }

    // Handle tags (if present) with caching
    if (extracted.relations.tags && extracted.relations.tags.length > 0) {
      const tagIds: string[] = [];
      
      for (const tagName of extracted.relations.tags) {
        // Check cache first
        let tag = caches.tags.get(tagName);
        if (!tag) {
          // Not in cache, fetch from DB
          tag = await findOrCreateTag(db, ctx.brandId, tagName);
          caches.tags.set(tagName, tag);
          // Only count as created if it was actually created
          if (tag.created) entitiesCreated++;
        }
        tagIds.push(tag.id);
      }
      
      // Set tags on product (replaces all existing tags)
      await setProductTags(db, product.id, tagIds);
    }

    return {
      success: true,
      variantCreated,
      variantUpdated,
      productCreated,
      productUpdated,
      productId: product.id,
      entitiesCreated,
    };
  } catch (error) {
    return {
      success: false,
      variantCreated: false,
      variantUpdated: false,
      productCreated: false,
      productUpdated: false,
      entitiesCreated: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

