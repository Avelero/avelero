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
} from "@v1/db/queries/catalog";
import {
  findColorByName,
  findSizeByName,
  findTagByName,
} from "@v1/db/queries/integrations";
import {
  integrationVariantLinks,
  productVariants,
  products,
} from "@v1/db/schema";
import { generateUniqueUpid, generateUniqueProductHandle } from "@v1/db/utils";
import { allColors } from "@v1/selections";
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


// =============================================================================
// REFERENCE ENTITY MATCHING
// =============================================================================

/**
 * Find or create a color by name.
 * Hex value priority:
 * 1. Shopify swatch hex (from integration)
 * 2. Default color palette match
 * 3. null (UI handles missing hex gracefully)
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

  // Hex priority: Shopify swatch > default palette > empty string
  // Strip # prefix if present from Shopify hex
  const normalizedShopifyHex = shopifyHex?.replace(/^#/, "") ?? null;
  const hex = normalizedShopifyHex ?? findDefaultColorHex(name) ?? "";

  const created = await createColor(db, brandId, { name, hex });
  if (!created) {
    throw new Error(`Failed to create color: ${name}`);
  }
  return { id: created.id, created: true };
}

/**
 * Find or create a size by name.
 * No sortIndex needed - ordering is stored at product level via sizeOrder array.
 */
export async function findOrCreateSize(
  db: Database,
  brandId: string,
  name: string
): Promise<{ id: string; created: boolean }> {
  const existing = await findSizeByName(db, brandId, name);
  if (existing) {
    return { id: existing.id, created: false };
  }

  const created = await createSize(db, brandId, { name });
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
 * Find a variant by any of its identifiers within a specific product.
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

/**
 * Find a variant by SKU or barcode across the entire brand.
 * This is used BEFORE creating a product to check if any existing product
 * in the brand already has a variant with matching identifiers.
 * 
 * Returns the variant ID and its parent product info if found.
 */
export async function findVariantByIdentifiersInBrand(
  db: Database,
  brandId: string,
  identifiers: {
    sku?: string;
    ean?: string;
    gtin?: string;
    barcode?: string;
  }
): Promise<{ 
  variantId: string; 
  productId: string; 
  productHandle: string;
} | null> {
  // Build conditions array - we only want to match on non-empty identifiers
  const identifierConditions = [];

  if (identifiers.sku?.trim()) {
    identifierConditions.push(eq(productVariants.sku, identifiers.sku.trim()));
  }
  if (identifiers.ean?.trim()) {
    identifierConditions.push(eq(productVariants.ean, identifiers.ean.trim()));
  }
  if (identifiers.gtin?.trim()) {
    identifierConditions.push(eq(productVariants.gtin, identifiers.gtin.trim()));
  }
  if (identifiers.barcode?.trim()) {
    identifierConditions.push(eq(productVariants.barcode, identifiers.barcode.trim()));
  }

  // No identifiers to search by
  if (identifierConditions.length === 0) return null;

  // Search across all variants in the brand
  const rows = await db
    .select({
      variantId: productVariants.id,
      productId: productVariants.productId,
      productHandle: products.productHandle,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        or(...identifierConditions)
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    variantId: row.variantId,
    productId: row.productId,
    productHandle: row.productHandle,
  };
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
 * @param sizeOrder - Ordered array of size IDs (preserves merchant's order from source)
 * @param colorOrder - Ordered array of color IDs (preserves merchant's order from source)
 */
export async function findOrCreateProduct(
  db: Database,
  storageClient: StorageClient,
  brandId: string,
  productName: string,
  productData: ExtractedValues["product"],
  externalProductId: string,
  brandIntegrationId: string,
  categoryId?: string | null,
  sizeOrder?: string[],
  colorOrder?: string[]
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
      sizeOrder: sizeOrder ?? [],
      colorOrder: colorOrder ?? [],
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

