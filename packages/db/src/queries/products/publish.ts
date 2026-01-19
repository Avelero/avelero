/**
 * Publish Operations.
 *
 * Orchestrates the complete publish flow for variants and products.
 * Publishing creates an immutable version record that persists independently
 * of the working layer.
 */

import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { productVariants, products } from "../../schema";
import {
  type DppSnapshot,
  createDppVersion,
  getLatestVersion,
} from "./dpp-versions";
import { getOrCreatePassport, updatePassportCurrentVersion } from "./passports";
import { generateDppSnapshot } from "./snapshot";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Result of publishing a single variant.
 */
export interface PublishVariantResult {
  success: boolean;
  variantId: string;
  passport: {
    id: string;
    upid: string;
    isNew: boolean;
  } | null;
  version: {
    id: string;
    versionNumber: number;
    publishedAt: string;
  } | null;
  error?: string;
}

/**
 * Result of publishing an entire product (all its variants).
 */
export interface PublishProductResult {
  success: boolean;
  productId: string;
  variants: PublishVariantResult[];
  totalPublished: number;
  totalFailed: number;
  error?: string;
}

/**
 * Result of bulk publishing multiple products.
 */
export interface BulkPublishResult {
  success: boolean;
  products: PublishProductResult[];
  totalProductsPublished: number;
  totalVariantsPublished: number;
  totalFailed: number;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Recursively sort all object keys for canonical JSON serialization.
 * This ensures deterministic hashing regardless of property order.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Calculate a content-only hash for deduplication.
 * This excludes metadata (publishedAt, versionNumber, schemaVersion) which change on every publish.
 * Used to determine if content has actually changed since the last version.
 */
function calculateContentOnlyHash(snapshot: DppSnapshot): string {
  // Extract only the content fields, excluding metadata
  const contentOnly = {
    "@context": snapshot["@context"],
    "@type": snapshot["@type"],
    "@id": snapshot["@id"],
    productIdentifiers: snapshot.productIdentifiers,
    productAttributes: snapshot.productAttributes,
    environmental: snapshot.environmental,
    materials: snapshot.materials,
    supplyChain: snapshot.supplyChain,
  };
  // Recursively sort all keys for deterministic serialization
  const sortedContent = sortObjectKeys(contentOnly);
  const canonicalJson = JSON.stringify(sortedContent);
  return createHash("sha256").update(canonicalJson, "utf8").digest("hex");
}

/**
 * Get variant data needed for publishing.
 */
async function getVariantForPublish(db: Database, variantId: string) {
  const [variant] = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      upid: productVariants.upid,
    })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1);

  if (!variant) return null;

  // Get product data
  const [product] = await db
    .select({
      id: products.id,
      brandId: products.brandId,
      status: products.status,
    })
    .from(products)
    .where(eq(products.id, variant.productId))
    .limit(1);

  if (!product) return null;

  return {
    variant,
    product,
  };
}

/**
 * Update product status after publishing.
 */
async function updateProductStatus(
  db: Database,
  productId: string,
  brandId: string,
) {
  await db
    .update(products)
    .set({
      status: "published",
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)));
}

// =============================================================================
// PUBLISH VARIANT
// =============================================================================

/**
 * Publish a single variant.
 *
 * This is the core publish operation that:
 * 1. Creates or retrieves the passport for the variant
 * 2. Generates a snapshot from current working data
 * 3. Creates a new immutable version record
 * 4. Updates the passport's current version
 * 5. Updates the product's publishing state
 *
 * @param db - Database instance
 * @param variantId - The variant ID to publish
 * @param brandId - The brand ID (for authorization verification)
 * @returns The publish result
 */
export async function publishVariant(
  db: Database,
  variantId: string,
  brandId: string,
): Promise<PublishVariantResult> {
  try {
    // Get variant and product data
    const data = await getVariantForPublish(db, variantId);
    if (!data) {
      return {
        success: false,
        variantId,
        passport: null,
        version: null,
        error: "Variant not found",
      };
    }

    // Verify brand ownership
    if (data.product.brandId !== brandId) {
      return {
        success: false,
        variantId,
        passport: null,
        version: null,
        error: "Unauthorized: variant does not belong to this brand",
      };
    }

    // Step 1: Get or create passport
    const { passport, isNew } = await getOrCreatePassport(
      db,
      variantId,
      brandId,
    );

    if (!passport) {
      return {
        success: false,
        variantId,
        passport: null,
        version: null,
        error: "Failed to create or retrieve passport",
      };
    }

    // Step 2: Generate snapshot from current working data
    const snapshot = await generateDppSnapshot(db, variantId, passport.upid);
    if (!snapshot) {
      return {
        success: false,
        variantId,
        passport: { id: passport.id, upid: passport.upid, isNew },
        version: null,
        error: "Failed to generate snapshot",
      };
    }

    // Step 2.5: Check if content has changed (deduplication)
    // Compare the content-only hash with the latest version's content
    const latestVersion = await getLatestVersion(db, passport.id);
    if (latestVersion) {
      const existingSnapshot = latestVersion.dataSnapshot as DppSnapshot;
      const newContentHash = calculateContentOnlyHash(snapshot);
      const existingContentHash = calculateContentOnlyHash(existingSnapshot);

      if (newContentHash === existingContentHash) {
        // Content hasn't changed, skip creating a new version
        return {
          success: true,
          variantId,
          passport: { id: passport.id, upid: passport.upid, isNew: false },
          version: {
            id: latestVersion.id,
            versionNumber: latestVersion.versionNumber,
            publishedAt: latestVersion.publishedAt,
          },
        };
      }
    }

    // Step 3: Create new version record (content has changed or no previous version)
    const version = await createDppVersion(db, passport.id, snapshot, "1.0");
    if (!version) {
      return {
        success: false,
        variantId,
        passport: { id: passport.id, upid: passport.upid, isNew },
        version: null,
        error: "Failed to create version record",
      };
    }

    // Step 4: Update passport's current version
    await updatePassportCurrentVersion(db, passport.id, version.id);

    // Step 5: Update product status
    await updateProductStatus(db, data.product.id, brandId);

    return {
      success: true,
      variantId,
      passport: { id: passport.id, upid: passport.upid, isNew },
      version: {
        id: version.id,
        versionNumber: version.versionNumber,
        publishedAt: version.publishedAt,
      },
    };
  } catch (error) {
    console.error("[PUBLISH DEBUG] publishVariant error:", error);
    return {
      success: false,
      variantId,
      passport: null,
      version: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// PUBLISH PRODUCT
// =============================================================================

/**
 * Publish all variants of a product.
 *
 * @param db - Database instance
 * @param productId - The product ID
 * @param brandId - The brand ID (for authorization verification)
 * @returns The publish result for all variants
 */
export async function publishProduct(
  db: Database,
  productId: string,
  brandId: string,
): Promise<PublishProductResult> {
  try {
    // Verify product exists and belongs to brand
    const [product] = await db
      .select({
        id: products.id,
        brandId: products.brandId,
      })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
      .limit(1);

    if (!product) {
      return {
        success: false,
        productId,
        variants: [],
        totalPublished: 0,
        totalFailed: 0,
        error: "Product not found or unauthorized",
      };
    }

    // Get all variants for this product
    const variants = await db
      .select({ id: productVariants.id })
      .from(productVariants)
      .where(eq(productVariants.productId, productId));

    if (variants.length === 0) {
      return {
        success: false,
        productId,
        variants: [],
        totalPublished: 0,
        totalFailed: 0,
        error: "No variants found for product",
      };
    }

    // Publish each variant concurrently
    const results = await Promise.all(
      variants.map((variant) => publishVariant(db, variant.id, brandId)),
    );

    const totalPublished = results.filter((r) => r.success).length;
    const totalFailed = results.filter((r) => !r.success).length;

    return {
      success: totalFailed === 0,
      productId,
      variants: results,
      totalPublished,
      totalFailed,
    };
  } catch (error) {
    return {
      success: false,
      productId,
      variants: [],
      totalPublished: 0,
      totalFailed: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// =============================================================================
// BULK PUBLISH
// =============================================================================

/**
 * Publish all variants of multiple products.
 *
 * @param db - Database instance
 * @param productIds - Array of product IDs to publish
 * @param brandId - The brand ID (for authorization verification)
 * @returns The bulk publish result
 */
export async function bulkPublishProducts(
  db: Database,
  productIds: string[],
  brandId: string,
): Promise<BulkPublishResult> {
  const productResults: PublishProductResult[] = [];

  for (const productId of productIds) {
    const result = await publishProduct(db, productId, brandId);
    productResults.push(result);
  }

  const totalProductsPublished = productResults.filter((r) => r.success).length;
  const totalVariantsPublished = productResults.reduce(
    (sum, r) => sum + r.totalPublished,
    0,
  );
  const totalFailed = productResults.reduce((sum, r) => sum + r.totalFailed, 0);

  return {
    success: totalFailed === 0,
    products: productResults,
    totalProductsPublished,
    totalVariantsPublished,
    totalFailed,
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if a product has any published variants.
 *
 * @param db - Database instance
 * @param productId - The product ID
 * @returns True if at least one variant has been published
 */
export async function hasPublishedVariants(
  db: Database,
  productId: string,
): Promise<boolean> {
  const [product] = await db
    .select({ status: products.status })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  return product?.status === "published";
}

/**
 * Get the publishing state for a product.
 *
 * @param db - Database instance
 * @param productId - The product ID
 * @param brandId - The brand ID (for authorization verification)
 * @returns The product's publishing state
 */
export async function getPublishingState(
  db: Database,
  productId: string,
  brandId: string,
) {
  const [product] = await db
    .select({
      status: products.status,
    })
    .from(products)
    .where(and(eq(products.id, productId), eq(products.brandId, brandId)))
    .limit(1);

  if (!product) return null;

  return {
    status: product.status as "published" | "unpublished" | "scheduled",
  };
}
