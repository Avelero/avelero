/**
 * Promotion Queries
 *
 * Database queries for primary integration promotion operations.
 * Handles operation tracking, variant assignment computations,
 * re-parenting, and cleanup.
 *
 * @see integration-refactor-plan.md Section 2.5 for algorithm details
 */

import { and, eq, sql, isNull, inArray, desc, asc, ne } from "drizzle-orm";
import type { Database } from "../../client";
import {
    promotionOperations,
    products,
    productVariants,
    brandIntegrations,
    integrationProductLinks,
    integrationVariantLinks,
    productVariantAttributes,
} from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface CreatePromotionOperationInput {
    brandId: string;
    newPrimaryIntegrationId: string;
    oldPrimaryIntegrationId?: string | null;
}

export interface UpdatePromotionProgressInput {
    status?: string;
    phase?: number;
    variantsProcessed?: number;
    totalVariants?: number;
    productsCreated?: number;
    productsArchived?: number;
    variantsMoved?: number;
    variantsOrphaned?: number;
    attributesCreated?: number;
    errorMessage?: string | null;
    completedAt?: string | null;
}

export interface VariantWithProduct {
    variantId: string;
    productId: string;
    barcode: string | null;
    sku: string | null;
}

export interface ProductIdMapping {
    externalProductId: string;
    aveleroProductId: string;
}

// =============================================================================
// OPERATION TRACKING
// =============================================================================

/**
 * Create a new promotion operation record.
 */
export async function createPromotionOperation(
    db: Database,
    input: CreatePromotionOperationInput,
) {
    const [row] = await db
        .insert(promotionOperations)
        .values({
            brandId: input.brandId,
            newPrimaryIntegrationId: input.newPrimaryIntegrationId,
            oldPrimaryIntegrationId: input.oldPrimaryIntegrationId ?? null,
            status: "preparing",
            phase: 0,
            startedAt: new Date().toISOString(),
        })
        .returning({
            id: promotionOperations.id,
            brandId: promotionOperations.brandId,
            status: promotionOperations.status,
            phase: promotionOperations.phase,
            createdAt: promotionOperations.createdAt,
        });
    return row;
}

/**
 * Get an incomplete promotion operation for a brand (for resumability).
 */
export async function getIncompletePromotionOperation(
    db: Database,
    brandId: string,
) {
    const [row] = await db
        .select()
        .from(promotionOperations)
        .where(
            and(
                eq(promotionOperations.brandId, brandId),
                ne(promotionOperations.status, "completed"),
                ne(promotionOperations.status, "failed"),
            ),
        )
        .orderBy(desc(promotionOperations.createdAt))
        .limit(1);
    return row;
}

/**
 * Get a promotion operation by ID.
 */
export async function getPromotionOperation(db: Database, operationId: string) {
    const [row] = await db
        .select()
        .from(promotionOperations)
        .where(eq(promotionOperations.id, operationId))
        .limit(1);
    return row;
}

/**
 * Update promotion operation progress.
 */
export async function updatePromotionProgress(
    db: Database,
    operationId: string,
    input: UpdatePromotionProgressInput,
) {
    const [row] = await db
        .update(promotionOperations)
        .set({
            status: input.status,
            phase: input.phase,
            variantsProcessed: input.variantsProcessed,
            totalVariants: input.totalVariants,
            productsCreated: input.productsCreated,
            productsArchived: input.productsArchived,
            variantsMoved: input.variantsMoved,
            variantsOrphaned: input.variantsOrphaned,
            attributesCreated: input.attributesCreated,
            errorMessage: input.errorMessage,
            completedAt: input.completedAt,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(promotionOperations.id, operationId))
        .returning({
            id: promotionOperations.id,
            status: promotionOperations.status,
            phase: promotionOperations.phase,
        });
    return row;
}

/**
 * Mark a promotion operation as failed.
 */
export async function markPromotionFailed(
    db: Database,
    operationId: string,
    errorMessage: string,
) {
    return updatePromotionProgress(db, operationId, {
        status: "failed",
        errorMessage,
        completedAt: new Date().toISOString(),
    });
}

/**
 * Mark a promotion operation as completed.
 */
export async function markPromotionCompleted(
    db: Database,
    operationId: string,
) {
    return updatePromotionProgress(db, operationId, {
        status: "completed",
        completedAt: new Date().toISOString(),
    });
}

// =============================================================================
// BRAND INTEGRATION MANAGEMENT
// =============================================================================

/**
 * Get the current primary integration for a brand.
 */
export async function getCurrentPrimaryIntegration(
    db: Database,
    brandId: string,
) {
    const [row] = await db
        .select({
            id: brandIntegrations.id,
            integrationId: brandIntegrations.integrationId,
            isPrimary: brandIntegrations.isPrimary,
        })
        .from(brandIntegrations)
        .where(
            and(
                eq(brandIntegrations.brandId, brandId),
                eq(brandIntegrations.isPrimary, true),
            ),
        )
        .limit(1);
    return row;
}

/**
 * Update integration primary status.
 * Sets the new integration as primary and demotes the old one.
 */
export async function updateIntegrationPrimaryStatus(
    db: Database,
    brandId: string,
    newPrimaryId: string,
) {
    // First, demote any existing primary
    await db
        .update(brandIntegrations)
        .set({
            isPrimary: false,
            updatedAt: new Date().toISOString(),
        })
        .where(
            and(
                eq(brandIntegrations.brandId, brandId),
                eq(brandIntegrations.isPrimary, true),
            ),
        );

    // Then, promote the new primary
    const [row] = await db
        .update(brandIntegrations)
        .set({
            isPrimary: true,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(brandIntegrations.id, newPrimaryId))
        .returning({
            id: brandIntegrations.id,
            isPrimary: brandIntegrations.isPrimary,
        });

    return row;
}

// =============================================================================
// VARIANT QUERIES
// =============================================================================

/**
 * Get all variants for a brand's integration products.
 * These are the variants that will be re-grouped.
 */
export async function getIntegrationVariants(
    db: Database,
    brandId: string,
): Promise<VariantWithProduct[]> {
    const rows = await db
        .select({
            variantId: productVariants.id,
            productId: productVariants.productId,
            barcode: productVariants.barcode,
            sku: productVariants.sku,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(eq(products.brandId, brandId), eq(products.source, "integration")),
        )
        .orderBy(asc(productVariants.createdAt));

    return rows;
}

/**
 * Get count of integration variants for a brand.
 */
export async function getIntegrationVariantCount(
    db: Database,
    brandId: string,
): Promise<number> {
    const [result] = await db
        .select({
            count: sql<number>`COUNT(*)::int`,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(eq(products.brandId, brandId), eq(products.source, "integration")),
        );

    return result?.count ?? 0;
}

/**
 * Re-parent variants in batch.
 * Moves variants from their current products to new products.
 */
export async function reParentVariantsBatch(
    db: Database,
    moves: Array<{ variantId: string; newProductId: string }>,
): Promise<number> {
    if (moves.length === 0) return 0;

    // Use a CTE to update all variants in a single query
    let updated = 0;

    // Process in chunks to avoid parameter limits
    const chunkSize = 100;
    for (let i = 0; i < moves.length; i += chunkSize) {
        const chunk = moves.slice(i, i + chunkSize);

        // Build VALUES clause for each move
        for (const move of chunk) {
            const [result] = await db
                .update(productVariants)
                .set({
                    productId: move.newProductId,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(productVariants.id, move.variantId))
                .returning({ id: productVariants.id });

            if (result) updated++;
        }
    }

    return updated;
}

// =============================================================================
// PRODUCT QUERIES
// =============================================================================

/**
 * Get integration products for a brand.
 */
export async function getIntegrationProducts(db: Database, brandId: string) {
    return db
        .select({
            id: products.id,
            name: products.name,
            sourceIntegrationId: products.sourceIntegrationId,
        })
        .from(products)
        .where(
            and(eq(products.brandId, brandId), eq(products.source, "integration")),
        )
        .orderBy(asc(products.createdAt));
}

/**
 * Get products that have no variants (empty after re-grouping).
 */
export async function getEmptyProducts(db: Database, brandId: string) {
    const rows = await db
        .select({
            id: products.id,
        })
        .from(products)
        .leftJoin(productVariants, eq(productVariants.productId, products.id))
        .where(
            and(eq(products.brandId, brandId), eq(products.source, "integration")),
        )
        .groupBy(products.id)
        .having(sql`COUNT(${productVariants.id}) = 0`);

    return rows.map((r) => r.id);
}

/**
 * Archive empty products (soft-delete by updating status).
 * Returns count of archived products.
 */
export async function archiveEmptyProducts(
    db: Database,
    brandId: string,
): Promise<number> {
    const emptyProductIds = await getEmptyProducts(db, brandId);

    if (emptyProductIds.length === 0) return 0;

    await db
        .update(products)
        .set({
            status: "archived",
            updatedAt: new Date().toISOString(),
        })
        .where(inArray(products.id, emptyProductIds));

    return emptyProductIds.length;
}

/**
 * Create a new product for the brand.
 */
export async function createProductForPromotion(
    db: Database,
    input: {
        brandId: string;
        name: string;
        productHandle: string;
        description?: string | null;
        imagePath?: string | null;
        sourceIntegrationId: string;
    },
) {
    const [row] = await db
        .insert(products)
        .values({
            brandId: input.brandId,
            name: input.name,
            productHandle: input.productHandle,
            description: input.description ?? null,
            imagePath: input.imagePath ?? null,
            source: "integration",
            sourceIntegrationId: input.sourceIntegrationId,
            status: "draft",
        })
        .returning({
            id: products.id,
            name: products.name,
            productHandle: products.productHandle,
        });
    return row;
}

/**
 * Update product data from new primary's external data.
 */
export async function updateProductFromExternal(
    db: Database,
    productId: string,
    data: {
        name?: string;
        description?: string | null;
        imagePath?: string | null;
        sourceIntegrationId?: string;
    },
) {
    const [row] = await db
        .update(products)
        .set({
            name: data.name,
            description: data.description,
            imagePath: data.imagePath,
            sourceIntegrationId: data.sourceIntegrationId,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(products.id, productId))
        .returning({ id: products.id });
    return row;
}

// =============================================================================
// INTEGRATION LINK MANAGEMENT
// =============================================================================

/**
 * Clear canonical status for all product links of an integration.
 */
export async function clearCanonicalStatus(
    db: Database,
    brandIntegrationId: string,
) {
    await db
        .update(integrationProductLinks)
        .set({
            isCanonical: false,
            updatedAt: new Date().toISOString(),
        })
        .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Get existing product links for an integration.
 */
export async function getProductLinksForIntegration(
    db: Database,
    brandIntegrationId: string,
) {
    return db
        .select({
            id: integrationProductLinks.id,
            productId: integrationProductLinks.productId,
            externalId: integrationProductLinks.externalId,
            isCanonical: integrationProductLinks.isCanonical,
        })
        .from(integrationProductLinks)
        .where(eq(integrationProductLinks.brandIntegrationId, brandIntegrationId));
}

/**
 * Upsert a product link for promotion operations.
 * Named differently to avoid conflict with existing link functions.
 */
export async function promotionUpsertProductLink(
    db: Database,
    input: {
        brandIntegrationId: string;
        productId: string;
        externalId: string;
        externalName?: string | null;
        isCanonical: boolean;
    },
) {
    const [row] = await db
        .insert(integrationProductLinks)
        .values({
            brandIntegrationId: input.brandIntegrationId,
            productId: input.productId,
            externalId: input.externalId,
            externalName: input.externalName ?? null,
            isCanonical: input.isCanonical,
            lastSyncedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: [
                integrationProductLinks.brandIntegrationId,
                integrationProductLinks.externalId,
            ],
            set: {
                productId: input.productId,
                externalName: input.externalName ?? null,
                isCanonical: input.isCanonical,
                lastSyncedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        })
        .returning({
            id: integrationProductLinks.id,
            productId: integrationProductLinks.productId,
        });
    return row;
}

/**
 * Upsert a variant link for promotion operations.
 * Named differently to avoid conflict with existing link functions.
 */
export async function promotionUpsertVariantLink(
    db: Database,
    input: {
        brandIntegrationId: string;
        variantId: string;
        externalId: string;
    },
) {
    const [row] = await db
        .insert(integrationVariantLinks)
        .values({
            brandIntegrationId: input.brandIntegrationId,
            variantId: input.variantId,
            externalId: input.externalId,
            lastSyncedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
            target: [
                integrationVariantLinks.brandIntegrationId,
                integrationVariantLinks.externalId,
            ],
            set: {
                variantId: input.variantId,
                lastSyncedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            },
        })
        .returning({
            id: integrationVariantLinks.id,
            variantId: integrationVariantLinks.variantId,
        });
    return row;
}

/**
 * Get variant links for an integration by barcode.
 */
export async function getVariantsByBarcode(
    db: Database,
    brandId: string,
    barcodes: string[],
): Promise<Map<string, { variantId: string; productId: string }>> {
    if (barcodes.length === 0) return new Map();

    const rows = await db
        .select({
            variantId: productVariants.id,
            productId: productVariants.productId,
            barcode: productVariants.barcode,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.brandId, brandId),
                inArray(productVariants.barcode, barcodes),
            ),
        );

    const map = new Map<string, { variantId: string; productId: string }>();
    for (const row of rows) {
        if (row.barcode) {
            map.set(row.barcode, {
                variantId: row.variantId,
                productId: row.productId,
            });
        }
    }
    return map;
}

// =============================================================================
// ATTRIBUTE HANDLING (Phase 8)
// =============================================================================

/**
 * Clear all attribute assignments for variants belonging to products
 * that are now managed by the new primary integration.
 * 
 * This is called during promotion to prepare for re-creating attributes
 * from the new primary's structure.
 */
export async function clearVariantAttributesForIntegration(
    db: Database,
    brandId: string,
    sourceIntegrationId: string,
): Promise<number> {
    // Get all variant IDs for products managed by this integration
    const variants = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.brandId, brandId),
                eq(products.source, "integration"),
                eq(products.sourceIntegrationId, sourceIntegrationId),
            ),
        );

    if (variants.length === 0) return 0;

    const variantIds = variants.map((v) => v.id);

    // Delete attribute assignments in batches to avoid parameter limits
    const batchSize = 500;
    let deleted = 0;

    for (let i = 0; i < variantIds.length; i += batchSize) {
        const batch = variantIds.slice(i, i + batchSize);
        const result = await db
            .delete(productVariantAttributes)
            .where(inArray(productVariantAttributes.variantId, batch));

        // Drizzle doesn't return count directly, but we can estimate
        deleted += batch.length;
    }

    return deleted;
}

/**
 * Get all variants for products managed by the new primary integration.
 * Used for attribute re-assignment after clearing.
 */
export async function getVariantsForIntegration(
    db: Database,
    brandId: string,
    sourceIntegrationId: string,
): Promise<Array<{ variantId: string; barcode: string | null }>> {
    const rows = await db
        .select({
            variantId: productVariants.id,
            barcode: productVariants.barcode,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.brandId, brandId),
                eq(products.source, "integration"),
                eq(products.sourceIntegrationId, sourceIntegrationId),
            ),
        );

    return rows;
}

/**
 * Batch insert variant attribute assignments.
 * Used during promotion to assign attributes from the new primary's structure.
 */
export async function batchInsertVariantAttributes(
    db: Database,
    assignments: Array<{ variantId: string; attributeValueId: string; sortOrder: number }>,
): Promise<number> {
    if (assignments.length === 0) return 0;

    // Insert in batches to avoid parameter limits
    const batchSize = 500;
    let inserted = 0;

    for (let i = 0; i < assignments.length; i += batchSize) {
        const batch = assignments.slice(i, i + batchSize);

        await db
            .insert(productVariantAttributes)
            .values(batch)
            .onConflictDoNothing();

        inserted += batch.length;
    }

    return inserted;
}
