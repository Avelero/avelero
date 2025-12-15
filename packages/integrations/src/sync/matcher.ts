/**
 * Entity Matching Logic
 *
 * Handles finding and creating reference entities and products.
 * Implements link-first, name-fallback matching strategy.
 */

import type { Database } from "@v1/db/client";
import { and, eq, or } from "@v1/db/index";
import {
  createBrandTag,
  createColor,
  createSize,
  findColorByName,
  findSizeByName,
  findTagByName,
} from "@v1/db/queries";
import {
  brandSizes,
  integrationVariantLinks,
  productVariants,
  products,
} from "@v1/db/schema";
import { generateUniqueUpid, generateUniqueProductHandle } from "@v1/db/utils";
import { allColors, allDefaultSizes } from "@v1/selections";
import {
  downloadAndUploadImage,
  isExternalImageUrl,
} from "@v1/supabase/utils/external-images";
import type { ExtractedValues, StorageClient } from "./types";

// =============================================================================
// HELPER FUNCTIONS FOR DEFAULT VALUES
// =============================================================================

/**
 * Find a color hex value from the default color palette.
 * Case-insensitive matching.
 */
function findDefaultColorHex(name: string): string | null {
  const normalized = name.toLowerCase().trim();
  const color = allColors.find(
    (c: { name: string; hex: string }) => c.name.toLowerCase() === normalized
  );
  return color?.hex ?? null;
}

/**
 * Get a random color hex from the default color palette.
 */
function getRandomColorHex(): string {
  const randomIndex = Math.floor(Math.random() * allColors.length);
  return allColors[randomIndex]?.hex ?? "808080";
}

/**
 * Find a default size's sortIndex by name.
 * Case-insensitive matching.
 * Returns undefined if not found in default sizes.
 */
function findDefaultSizeSortIndex(name: string): number | undefined {
  const normalized = name.toLowerCase().trim();
  const size = allDefaultSizes.find(
    (s: { name: string; sortIndex: number }) =>
      s.name.toLowerCase() === normalized
  );
  return size?.sortIndex;
}

/**
 * Generate a unique custom sortIndex for sizes not in the default list.
 * Custom sizes use the 0-999 range to avoid conflicts with standard size ranges.
 *
 * Range allocation in @v1/selections:
 * - Custom sizes: 0-999
 * - Letter sizes: 1000-1099
 * - US Numeric apparel: 2000-2099
 * - Waist sizes: 3000-3099
 * - US Shoe sizes: 4000-4199
 * - EU Shoe sizes: 5000-5199
 * - UK Shoe sizes: 6000-6199
 * - One Size options: 9000-9099
 */
async function generateCustomSortIndex(
  db: Database,
  brandId: string
): Promise<number> {
  // Get all existing sizes for this brand to find max sortIndex in custom range
  const existingSizes = await db
    .select({ sortIndex: brandSizes.sortIndex })
    .from(brandSizes)
    .where(eq(brandSizes.brandId, brandId));

  // Find the max sortIndex in the custom range (0-999)
  let maxCustomIndex = -1;
  for (const size of existingSizes) {
    const idx = size.sortIndex ?? 0;
    if (idx >= 0 && idx < 1000 && idx > maxCustomIndex) {
      maxCustomIndex = idx;
    }
  }

  // Return next available index in custom range
  return maxCustomIndex + 1;
}

// =============================================================================
// REFERENCE ENTITY MATCHING
// =============================================================================

/**
 * Find or create a color by name.
 * Hex value priority:
 * 1. Shopify swatch hex (from integration)
 * 2. Default color palette match
 * 3. Gray fallback
 *
 * @param shopifyHex - Optional hex value from Shopify's swatch.color (e.g., "#FF8A00")
 */
export async function findOrCreateColor(
  db: Database,
  brandId: string,
  name: string,
  shopifyHex?: string | null
): Promise<{ id: string; created: boolean }> {
  const existing = await findColorByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Hex priority: Shopify swatch > default palette > gray fallback
  // Strip # prefix if present from Shopify hex
  const normalizedShopifyHex = shopifyHex?.replace(/^#/, "") ?? null;
  const hex = normalizedShopifyHex ?? findDefaultColorHex(name) ?? "808080";

  const created = await createColor(db, brandId, { name, hex });
  if (!created) {
    throw new Error(`Failed to create color: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a size by name.
 * Sort index priority:
 * 1. Default size palette match (uses standard ranges 1000-9099)
 * 2. Shopify optionValues index (uses 10000+ range, preserves merchant's order)
 * 3. Generated custom index (uses 0-999 range)
 *
 * Range allocation:
 * - Custom sizes (manual): 0-999
 * - Standard sizes: 1000-9099
 * - Shopify-synced custom sizes: 10000+ (preserves merchant order)
 *
 * @param shopifyIndex - Optional index from Shopify's optionValues array (0-based)
 */
export async function findOrCreateSize(
  db: Database,
  brandId: string,
  name: string,
  shopifyIndex?: number | null
): Promise<{ id: string; created: boolean }> {
  const existing = await findSizeByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Sort index priority: default palette > Shopify index > generated custom
  let sortIndex = findDefaultSizeSortIndex(name);

  if (sortIndex === undefined && shopifyIndex !== null && shopifyIndex !== undefined) {
    // Use Shopify's order in a dedicated range (10000+)
    // Multiply by 10 to leave gaps for manual reordering if needed
    sortIndex = 10000 + shopifyIndex * 10;
  }

  if (sortIndex === undefined) {
    sortIndex = await generateCustomSortIndex(db, brandId);
  }

  const created = await createSize(db, brandId, { name, sortIndex });
  if (!created) {
    throw new Error(`Failed to create size: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a tag by name.
 * If creating, assigns a random color from the default color palette.
 */
export async function findOrCreateTag(
  db: Database,
  brandId: string,
  name: string
): Promise<{ id: string; created: boolean }> {
  const existing = await findTagByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  // Assign a random color for the tag
  const hex = getRandomColorHex();

  const created = await createBrandTag(db, brandId, { name, hex });
  if (!created) {
    throw new Error(`Failed to create tag: ${name}`);
  }
  return { id: created.id, created: true };
}

// =============================================================================
// VARIANT MATCHING
// =============================================================================

/**
 * Find a variant by any of its identifiers.
 */
export async function findVariantByIdentifiers(
  db: Database,
  productId: string,
  identifiers: {
    sku?: string;
    ean?: string;
    gtin?: string;
    barcode?: string;
  }
): Promise<{ id: string } | null> {
  // Build conditions array with type-safe comparisons
  const identifierConditions = [];

  if (identifiers.sku) {
    identifierConditions.push(eq(productVariants.sku, identifiers.sku));
  }
  if (identifiers.ean) {
    identifierConditions.push(eq(productVariants.ean, identifiers.ean));
  }
  if (identifiers.gtin) {
    identifierConditions.push(eq(productVariants.gtin, identifiers.gtin));
  }
  if (identifiers.barcode) {
    identifierConditions.push(eq(productVariants.barcode, identifiers.barcode));
  }

  if (identifierConditions.length === 0) return null;

  // Use raw SQL for the query to avoid type issues
  const rows = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.productId, productId),
        or(...identifierConditions)
      )
    )
    .limit(1);

  return rows[0] ?? null;
}

// =============================================================================
// PRODUCT MATCHING
// =============================================================================

/**
 * Download external image and upload to storage if needed.
 * Returns the storage path, or null if download fails.
 * If the URL is already a storage path (not external), returns it unchanged.
 */
export async function processImageUrl(
  storageClient: StorageClient,
  brandId: string,
  productId: string,
  imageUrl: string | null | undefined
): Promise<string | null> {
  if (!imageUrl) return null;

  // If not an external URL, return as-is (already a storage path)
  if (!isExternalImageUrl(imageUrl)) return imageUrl;

  // Download and upload to our storage
  // Use same path structure as normal uploads: {brandId}/{filename}
  const storagePath = await downloadAndUploadImage(storageClient, {
    url: imageUrl,
    bucket: "products",
    pathPrefix: brandId,
  });

  return storagePath;
}

/**
 * Find or create a product by name and external product ID.
 *
 * Logic:
 * 1. First tries to find an existing product that was previously synced
 *    from the same external product ID (via variant links).
 * 2. If not found, creates a new product with a unique handle
 *    generated from the product name.
 *
 * This approach ensures:
 * - Re-syncs of the same external product update the existing product
 * - Product name changes in the external system don't create duplicates
 * - New products get clean, readable handles based on their names
 *
 * @param categoryId - Optional category UUID resolved from external taxonomy mapping
 */
export async function findOrCreateProduct(
  db: Database,
  storageClient: StorageClient,
  brandId: string,
  productName: string,
  productData: ExtractedValues["product"],
  externalProductId: string,
  brandIntegrationId: string,
  categoryId?: string | null
): Promise<{ id: string; productHandle: string; created: boolean }> {
  // First, try to find an existing product that was previously synced
  // from the same external product ID by checking variant links.
  // This ensures re-syncs of the same Shopify product update the existing
  // Avelero product instead of creating duplicates.
  const linkedProductRows = await db
    .select({
      productId: productVariants.productId,
      productHandle: products.productHandle,
    })
    .from(integrationVariantLinks)
    .innerJoin(
      productVariants,
      eq(productVariants.id, integrationVariantLinks.variantId)
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(integrationVariantLinks.brandIntegrationId, brandIntegrationId),
        eq(integrationVariantLinks.externalProductId, externalProductId),
        eq(products.brandId, brandId)
      )
    )
    .limit(1);

  const linkedProduct = linkedProductRows[0];
  if (linkedProduct) {
    return {
      id: linkedProduct.productId,
      productHandle: linkedProduct.productHandle,
      created: false,
    };
  }

  // No existing product found - generate a unique handle from the name
  const productHandle = await generateUniqueProductHandle({
    name: productName,
    isTaken: async (candidate) => {
      const rows = await db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.brandId, brandId),
            eq(products.productHandle, candidate)
          )
        )
        .limit(1);
      return Boolean(rows[0]);
    },
  });

  // Create new product first (without image) to get the product ID
  // categoryId is resolved from external taxonomy mapping (e.g., Shopify categories)
  const insertedRows = await db
    .insert(products)
    .values({
      brandId,
      name: productName,
      productHandle,
      description: (productData.description as string) ?? null,
      primaryImagePath: null, // Set after we have product ID
      status: "unpublished", // New products start unpublished
      webshopUrl: (productData.webshopUrl as string) ?? null,
      price: (productData.price as number)?.toString() ?? null,
      currency: (productData.currency as string) ?? null,
      salesStatus: (productData.salesStatus as string) ?? null,
      categoryId: categoryId ?? null,
    })
    .returning({ id: products.id });

  const created = insertedRows[0];
  if (!created) {
    throw new Error(`Failed to create product: ${productHandle}`);
  }

  // Now process image with the product ID we have
  const imagePath = await processImageUrl(
    storageClient,
    brandId,
    created.id,
    productData.primaryImagePath as string | undefined
  );

  // Update product with the image path if we got one
  if (imagePath) {
    await db
      .update(products)
      .set({ primaryImagePath: imagePath })
      .where(eq(products.id, created.id));
  }

  return { id: created.id, productHandle, created: true };
}

/**
 * Generate a unique UPID for a new variant.
 */
export async function generateVariantUpid(db: Database): Promise<string> {
  return generateUniqueUpid({
    isTaken: async (candidate) => {
      const rows = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .where(eq(productVariants.upid, candidate))
        .limit(1);
      return Boolean(rows[0]);
    },
  });
}

