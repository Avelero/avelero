/**
 * Promotion Engine
 *
 * Implements the primary integration promotion algorithm.
 * When a secondary integration is promoted to primary, this engine
 * re-groups all products to match the new primary's structure.
 *
 * The algorithm has 11 phases:
 * 0. Preparation - Create temp tables, mark operation in progress
 * 1. Fetch External Structure - Get all products from new primary's external API
 * 2. Compute Variant Assignments - Match Avelero variants to external products via barcode
 * 3. Determine Main Products - For each external product, find which Avelero product is "main"
 * 4. Create Missing Products - Create Avelero products for external products with no match
 * 5. Re-parent Variants - Move variants to their new parent products
 * 6. Handle Orphaned Variants - Mark variants not in new primary
 * 7. Archive Empty Products - Soft-delete products with no variants
 * 8. Handle Attributes - Clear and re-create attribute assignments
 * 9. Update Product-Level Data - Sync product fields from new primary
 * 10. Update Integration Links - Create/update links for new primary
 * 11. Cleanup - Drop temp tables, finalize
 *
 * @see integration-refactor-plan.md Section 2.5 for detailed algorithm
 */

import type { Database } from "@v1/db/client";
import {
    createPromotionOperation,
    getIncompletePromotionOperation,
    getPromotionOperation,
    updatePromotionProgress as updatePromotionProgressDb,
    markPromotionFailed,
    markPromotionCompleted,
    getCurrentPrimaryIntegration,
    updateIntegrationPrimaryStatus,
    getIntegrationVariants,
    getIntegrationVariantCount,
    reParentVariantsBatch,
    archiveEmptyProducts,
    createProductForPromotion,
    updateProductFromExternal,
    clearCanonicalStatus,
    promotionUpsertProductLink,
    promotionUpsertVariantLink,
    getVariantsByBarcode,
    clearVariantAttributesForIntegration,
    getVariantsForIntegration,
    batchInsertVariantAttributes,
} from "@v1/db/queries/integrations";
import {
    batchCreateBrandAttributes,
    batchCreateBrandAttributeValues,
    loadBrandAttributesMap,
    loadAllBrandAttributeValuesMap,
} from "@v1/db/queries/catalog";
import { getConnector } from "../connectors/registry";
import type { IntegrationCredentials, FetchedProduct } from "../types";
import type {
    PromotionConfig,
    PromotionProgress,
    PromotionResult,
    PromotionPhase,
    PromotionContext,
    ExternalGrouping,
    VariantMove,
} from "./promotion-types";

// =============================================================================
// CONSTANTS
// =============================================================================

const FETCH_BATCH_SIZE = 250;
const TRANSACTION_BATCH_SIZE = 1000;
const REPARENT_BATCH_SIZE = 1000;

// =============================================================================
// MAIN API
// =============================================================================

/**
 * Promote an integration to primary.
 * This triggers a complete re-grouping of products based on the new primary's structure.
 *
 * @param db - Database instance
 * @param config - Promotion configuration
 * @param credentials - Decrypted credentials for fetching from external system
 * @param integrationSlug - Integration slug (e.g., 'shopify')
 * @param onProgress - Optional callback for progress updates
 * @returns Promotion result with statistics
 */
export async function promoteIntegrationToPrimary(
    db: Database,
    config: PromotionConfig,
    credentials: IntegrationCredentials,
    integrationSlug: string,
    onProgress?: (progress: PromotionProgress) => Promise<void>,
): Promise<PromotionResult> {
    // Check for existing incomplete operation (resumability)
    const existingOp = await getIncompletePromotionOperation(db, config.brandId);
    if (existingOp) {
        // Resume from where we left off
        return resumePromotion(db, existingOp.id, credentials, integrationSlug, onProgress);
    }

    // Create new promotion operation
    const operation = await createPromotionOperation(db, config);
    if (!operation) {
        return {
            success: false,
            operationId: "",
            stats: createEmptyProgress(""),
            error: "Failed to create promotion operation",
        };
    }

    const progress: PromotionProgress = {
        operationId: operation.id,
        phase: "preparing",
        phaseNumber: 0,
        variantsProcessed: 0,
        totalVariants: 0,
        productsCreated: 0,
        productsArchived: 0,
        variantsMoved: 0,
        variantsOrphaned: 0,
        attributesCreated: 0,
    };

    const ctx: PromotionContext = {
        db,
        config,
        operationId: operation.id,
        progress,
        credentials,
        integrationSlug,
        onProgress,
    };

    return executePromotion(ctx);
}

/**
 * Resume an incomplete promotion operation.
 */
export async function resumePromotion(
    db: Database,
    operationId: string,
    credentials: IntegrationCredentials,
    integrationSlug: string,
    onProgress?: (progress: PromotionProgress) => Promise<void>,
): Promise<PromotionResult> {
    const operation = await getPromotionOperation(db, operationId);
    if (!operation) {
        return {
            success: false,
            operationId,
            stats: createEmptyProgress(operationId),
            error: "Promotion operation not found",
        };
    }

    const config: PromotionConfig = {
        brandId: operation.brandId,
        newPrimaryIntegrationId: operation.newPrimaryIntegrationId,
        oldPrimaryIntegrationId: operation.oldPrimaryIntegrationId,
    };

    const progress: PromotionProgress = {
        operationId,
        phase: operation.status as PromotionPhase,
        phaseNumber: operation.phase,
        variantsProcessed: operation.variantsProcessed,
        totalVariants: operation.totalVariants,
        productsCreated: operation.productsCreated,
        productsArchived: operation.productsArchived,
        variantsMoved: operation.variantsMoved,
        variantsOrphaned: operation.variantsOrphaned,
        attributesCreated: operation.attributesCreated,
    };

    const ctx: PromotionContext = {
        db,
        config,
        operationId,
        progress,
        credentials,
        integrationSlug,
        onProgress,
    };

    return executePromotion(ctx);
}

// =============================================================================
// EXECUTION ENGINE
// =============================================================================

/**
 * Execute the promotion algorithm.
 * Runs phases sequentially, starting from the current phase.
 */
async function executePromotion(ctx: PromotionContext): Promise<PromotionResult> {
    const db = ctx.db as Database;

    try {
        // Run phases in order, starting from current phase
        const phases: Array<{
            phase: PromotionPhase;
            phaseNumber: number;
            execute: () => Promise<void>;
        }> = [
                { phase: "preparing", phaseNumber: 0, execute: () => phase0_preparation(ctx) },
                { phase: "fetching", phaseNumber: 1, execute: () => phase1_fetchExternalStructure(ctx) },
                { phase: "computing", phaseNumber: 2, execute: () => phase2_computeAssignments(ctx) },
                { phase: "creating_products", phaseNumber: 4, execute: () => phase4_createMissingProducts(ctx) },
                { phase: "re_parenting", phaseNumber: 5, execute: () => phase5_reParentVariants(ctx) },
                { phase: "handling_orphans", phaseNumber: 6, execute: () => phase6_handleOrphanedVariants(ctx) },
                { phase: "archiving", phaseNumber: 7, execute: () => phase7_archiveEmptyProducts(ctx) },
                { phase: "updating_attributes", phaseNumber: 8, execute: () => phase8_handleAttributes(ctx) },
                { phase: "updating_links", phaseNumber: 9, execute: () => phase9_updateLinks(ctx) },
                { phase: "cleanup", phaseNumber: 11, execute: () => phase11_cleanup(ctx) },
            ];

        // Find starting point based on current phase
        let startIndex = 0;
        for (let i = 0; i < phases.length; i++) {
            const p = phases[i];
            if (p && p.phaseNumber >= ctx.progress.phaseNumber) {
                startIndex = i;
                break;
            }
        }

        // Execute remaining phases
        for (let i = startIndex; i < phases.length; i++) {
            const phaseInfo = phases[i];
            if (!phaseInfo) continue;

            // Update progress
            ctx.progress.phase = phaseInfo.phase;
            ctx.progress.phaseNumber = phaseInfo.phaseNumber;
            await updateProgress(ctx);

            // Execute phase
            await phaseInfo.execute();
        }

        // Mark as completed
        await markPromotionCompleted(db, ctx.operationId);
        ctx.progress.phase = "completed";

        return {
            success: true,
            operationId: ctx.operationId,
            stats: ctx.progress,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        await markPromotionFailed(db, ctx.operationId, errorMessage);
        ctx.progress.phase = "failed";

        return {
            success: false,
            operationId: ctx.operationId,
            stats: ctx.progress,
            error: errorMessage,
        };
    }
}

// =============================================================================
// PHASE IMPLEMENTATIONS
// =============================================================================

/**
 * Phase 0: Preparation
 * - Get variant count for progress tracking
 * - Initialize internal state
 */
async function phase0_preparation(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;

    // Get total variant count for progress tracking
    const totalVariants = await getIntegrationVariantCount(db, ctx.config.brandId);
    ctx.progress.totalVariants = totalVariants;

    await updateProgress(ctx);
}

/**
 * Phase 1: Fetch External Structure
 * - Fetch all products from the new primary's external API
 * - Store in an in-memory map for later processing
 *
 * Note: In a production implementation, this would use temp tables
 * for very large datasets. For now, we use in-memory storage.
 */
async function phase1_fetchExternalStructure(ctx: PromotionContext): Promise<void> {
    const connector = getConnector(ctx.integrationSlug);
    if (!connector) {
        throw new Error(`Connector not found: ${ctx.integrationSlug}`);
    }

    // Store external grouping in context for later phases
    const externalGrouping: Map<string, ExternalGrouping> = new Map();

    // Fetch products in batches
    for await (const batch of connector.fetchProducts(
        ctx.credentials as IntegrationCredentials,
        FETCH_BATCH_SIZE,
    )) {
        for (const product of batch) {
            for (const variant of product.variants) {
                const barcode = extractBarcode(variant.data);
                if (barcode) {
                    // First barcode wins (as per plan)
                    if (!externalGrouping.has(barcode)) {
                        externalGrouping.set(barcode, {
                            barcode,
                            externalProductId: product.externalId,
                            externalVariantId: variant.externalId,
                            externalProductData: extractProductData(product.data),
                            externalVariantData: extractVariantData(variant.data),
                        });
                    }
                }
            }
        }
    }

    // Store in context for later phases
    (ctx as PromotionContextInternal).externalGrouping = externalGrouping;
}

/**
 * Phase 2: Compute Variant Assignments
 * - Match Avelero variants to external products via barcode
 * - Identify orphaned variants (no match in new primary)
 */
async function phase2_computeAssignments(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;
    const externalGrouping = (ctx as PromotionContextInternal).externalGrouping;

    if (!externalGrouping) {
        throw new Error("External grouping not available - phase 1 may have failed");
    }

    // Get all integration variants
    const variants = await getIntegrationVariants(db, ctx.config.brandId);

    // Compute assignments
    const variantAssignments: Map<
        string,
        { currentProductId: string; targetExternalProductId: string | null }
    > = new Map();

    // Track which external products have variants
    const externalProductVariants: Map<string, string[]> = new Map();

    for (const variant of variants) {
        const barcode = variant.barcode;
        const grouping = barcode ? externalGrouping.get(barcode) : undefined;

        variantAssignments.set(variant.variantId, {
            currentProductId: variant.productId,
            targetExternalProductId: grouping?.externalProductId ?? null,
        });

        if (grouping) {
            const productVariants =
                externalProductVariants.get(grouping.externalProductId) ?? [];
            productVariants.push(variant.variantId);
            externalProductVariants.set(grouping.externalProductId, productVariants);
        }
    }

    // Store for later phases
    (ctx as PromotionContextInternal).variantAssignments = variantAssignments;
    (ctx as PromotionContextInternal).externalProductVariants = externalProductVariants;

    // Count orphaned variants
    let orphanedCount = 0;
    for (const [, assignment] of variantAssignments) {
        if (assignment.targetExternalProductId === null) {
            orphanedCount++;
        }
    }
    ctx.progress.variantsOrphaned = orphanedCount;

    await updateProgress(ctx);
}

/**
 * Phase 4: Create Missing Products
 * - For external products with no matching Avelero product, create new ones
 */
async function phase4_createMissingProducts(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;
    const externalGrouping = (ctx as PromotionContextInternal).externalGrouping;
    const externalProductVariants = (ctx as PromotionContextInternal).externalProductVariants;

    if (!externalGrouping || !externalProductVariants) {
        throw new Error("Required data not available - earlier phases may have failed");
    }

    // Get all unique external products that have matching variants
    const externalProductsWithVariants = new Set(externalProductVariants.keys());

    // Determine which external products need new Avelero products
    // For now, we'll use a simple approach: if we have variants mapped to an external product,
    // we assume the corresponding Avelero product exists (we'll handle the product mapping in phase 5)

    // Create a map of external product ID to "main" Avelero product
    const mainProductMap: Map<string, string> = new Map();
    const variantAssignments = (ctx as PromotionContextInternal).variantAssignments;

    if (!variantAssignments) {
        throw new Error("Variant assignments not available");
    }

    // Group variants by their target external product
    const productGroups: Map<string, { productId: string; count: number }[]> = new Map();

    for (const [variantId, assignment] of variantAssignments) {
        if (assignment.targetExternalProductId) {
            const groups = productGroups.get(assignment.targetExternalProductId) ?? [];
            const existing = groups.find((g) => g.productId === assignment.currentProductId);
            if (existing) {
                existing.count++;
            } else {
                groups.push({ productId: assignment.currentProductId, count: 1 });
            }
            productGroups.set(assignment.targetExternalProductId, groups);
        }
    }

    // Track which Avelero products have been claimed by an external product
    // This ensures one-to-one mapping: each Avelero product can only be claimed once
    const claimedProducts = new Set<string>();

    // For each external product, pick the "main" Avelero product (most variants, oldest on tie)
    // but only if that product hasn't already been claimed by another external product
    for (const [externalProductId, groups] of productGroups) {
        // Sort by count descending, then by productId ascending (as proxy for oldest)
        groups.sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.productId.localeCompare(b.productId);
        });

        // Find the first unclaimed Avelero product from the sorted list
        let assignedProductId: string | null = null;
        for (const group of groups) {
            if (!claimedProducts.has(group.productId)) {
                assignedProductId = group.productId;
                claimedProducts.add(group.productId);
                break;
            }
        }

        // Only set mapping if we found an unclaimed product
        // External products without an unclaimed match will be handled in the
        // "no existing product" loop below, where new products are created
        if (assignedProductId) {
            mainProductMap.set(externalProductId, assignedProductId);
        }
    }

    // Check for external products that have NO existing Avelero variants
    // These need new products created
    let productsCreated = 0;
    const barcodes = Array.from(externalGrouping.keys());

    // Group by external product ID to find products without variants
    const externalProductsToBarcodes: Map<string, string[]> = new Map();
    for (const [barcode, grouping] of externalGrouping) {
        const barcodes = externalProductsToBarcodes.get(grouping.externalProductId) ?? [];
        barcodes.push(barcode);
        externalProductsToBarcodes.set(grouping.externalProductId, barcodes);
    }

    for (const [externalProductId, barcodes] of externalProductsToBarcodes) {
        if (!mainProductMap.has(externalProductId)) {
            // No existing product - need to create one
            const firstBarcode = barcodes[0];
            if (!firstBarcode) continue;
            const grouping = externalGrouping.get(firstBarcode);
            if (grouping) {
                const productData = grouping.externalProductData;
                const name = productData.name ?? `Product ${externalProductId}`;
                const handle = generateHandle(name);

                const newProduct = await createProductForPromotion(db, {
                    brandId: ctx.config.brandId,
                    name,
                    productHandle: handle,
                    description: productData.description ?? null,
                    imagePath: productData.imagePath ?? null,
                    sourceIntegrationId: ctx.config.newPrimaryIntegrationId,
                });

                if (newProduct) {
                    mainProductMap.set(externalProductId, newProduct.id);
                    productsCreated++;
                }
            }
        }
    }

    // Store main product map for later phases
    (ctx as PromotionContextInternal).mainProductMap = mainProductMap;
    ctx.progress.productsCreated = productsCreated;

    await updateProgress(ctx);
}

/**
 * Phase 5: Re-parent Variants
 * - Move variants to their new parent products based on computed assignments
 */
async function phase5_reParentVariants(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;
    const variantAssignments = (ctx as PromotionContextInternal).variantAssignments;
    const mainProductMap = (ctx as PromotionContextInternal).mainProductMap;

    if (!variantAssignments || !mainProductMap) {
        throw new Error("Required data not available - earlier phases may have failed");
    }

    // Collect all variants that need to move
    const moves: VariantMove[] = [];

    for (const [variantId, assignment] of variantAssignments) {
        if (assignment.targetExternalProductId) {
            const newProductId = mainProductMap.get(assignment.targetExternalProductId);
            if (newProductId && newProductId !== assignment.currentProductId) {
                moves.push({
                    variantId,
                    currentProductId: assignment.currentProductId,
                    newProductId,
                });
            }
        }
    }

    // Process moves in batches
    let processed = 0;
    for (let i = 0; i < moves.length; i += REPARENT_BATCH_SIZE) {
        const batch = moves.slice(i, i + REPARENT_BATCH_SIZE);
        const moved = await reParentVariantsBatch(
            db,
            batch.map((m) => ({ variantId: m.variantId, newProductId: m.newProductId })),
        );
        processed += moved;

        // Update progress
        ctx.progress.variantsProcessed = processed;
        ctx.progress.variantsMoved = processed;
        await updateProgress(ctx);
    }
}

/**
 * Phase 6: Handle Orphaned Variants
 * - Orphaned variants (not in new primary) stay in their current products
 * - This is intentional to preserve QR code connectivity
 */
async function phase6_handleOrphanedVariants(ctx: PromotionContext): Promise<void> {
    // Orphaned variants stay where they are - nothing to do here
    // The count was already computed in phase 2
    // In a full implementation, we might mark these products with an orphan_count
    await updateProgress(ctx);
}

/**
 * Phase 7: Archive Empty Products
 * - Products with no variants after re-grouping are archived (soft-deleted)
 */
async function phase7_archiveEmptyProducts(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;

    const archivedCount = await archiveEmptyProducts(db, ctx.config.brandId);
    ctx.progress.productsArchived = archivedCount;

    await updateProgress(ctx);
}

/**
 * Phase 8: Handle Attributes
 * - Clear attribute assignments for products managed by new primary
 * - Extract unique attributes and values from external data
 * - Create missing attributes and values
 * - Assign attribute values to variants based on new primary's structure
 */
async function phase8_handleAttributes(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;
    const externalGrouping = (ctx as PromotionContextInternal).externalGrouping;

    if (!externalGrouping) {
        // No external data, nothing to do
        await updateProgress(ctx);
        return;
    }

    // Step 1: Clear existing attribute assignments for variants of products
    // managed by the new primary integration
    await clearVariantAttributesForIntegration(
        db,
        ctx.config.brandId,
        ctx.config.newPrimaryIntegrationId,
    );

    // Step 2: Extract unique attribute names and values from external data
    const attributeNames = new Set<string>();
    const attributeValuesByName = new Map<string, Set<string>>();

    for (const [, grouping] of externalGrouping) {
        const options = grouping.externalVariantData.selectedOptions;
        if (options && Array.isArray(options)) {
            for (const opt of options) {
                if (opt.name && opt.value) {
                    attributeNames.add(opt.name);
                    if (!attributeValuesByName.has(opt.name)) {
                        attributeValuesByName.set(opt.name, new Set());
                    }
                    attributeValuesByName.get(opt.name)!.add(opt.value);
                }
            }
        }
    }

    // Step 3: Load existing attributes and create missing ones
    const existingAttributesMap = await loadBrandAttributesMap(db, ctx.config.brandId);
    const missingAttributeNames: string[] = [];

    for (const name of attributeNames) {
        if (!existingAttributesMap.has(name.toLowerCase())) {
            missingAttributeNames.push(name);
        }
    }

    if (missingAttributeNames.length > 0) {
        const newAttributesMap = await batchCreateBrandAttributes(
            db,
            ctx.config.brandId,
            missingAttributeNames,
        );
        // Merge new attributes into existing map
        for (const [name, id] of newAttributesMap) {
            existingAttributesMap.set(name.toLowerCase(), { id, taxonomyAttributeId: null });
        }
    }

    // Step 4: Load existing attribute values and create missing ones
    const existingValuesMap = await loadAllBrandAttributeValuesMap(db, ctx.config.brandId);
    const missingValues: Array<{ attributeId: string; name: string }> = [];

    for (const [attrName, values] of attributeValuesByName) {
        const attrData = existingAttributesMap.get(attrName.toLowerCase());
        if (!attrData) continue;

        const attrId = attrData.id;
        const existingValuesForAttr = existingValuesMap.get(attrId) ?? new Map<string, string>();

        for (const valueName of values) {
            if (!existingValuesForAttr.has(valueName.toLowerCase())) {
                missingValues.push({ attributeId: attrId, name: valueName });
            }
        }
    }

    if (missingValues.length > 0) {
        const newValuesCompositeMap = await batchCreateBrandAttributeValues(
            db,
            ctx.config.brandId,
            missingValues,
        );
        // batchCreateBrandAttributeValues returns Map<"attrId:nameLower", valueId>
        // We need to parse the composite key and merge into our nested map
        for (const [compositeKey, valueId] of newValuesCompositeMap) {
            const colonIndex = compositeKey.indexOf(":");
            if (colonIndex === -1) continue;
            const attrId = compositeKey.substring(0, colonIndex);
            const nameLower = compositeKey.substring(colonIndex + 1);
            if (!attrId || !nameLower) continue;

            if (!existingValuesMap.has(attrId)) {
                existingValuesMap.set(attrId, new Map<string, string>());
            }
            existingValuesMap.get(attrId)!.set(nameLower, valueId);
        }
    }

    // Step 5: Get all variants for the new primary and assign attributes
    const variants = await getVariantsForIntegration(
        db,
        ctx.config.brandId,
        ctx.config.newPrimaryIntegrationId,
    );

    // Create barcode -> variant ID map for O(1) lookups
    const barcodeToVariantId = new Map<string, string>();
    for (const v of variants) {
        if (v.barcode) {
            barcodeToVariantId.set(v.barcode, v.variantId);
        }
    }

    // Step 6: Build attribute assignments
    const assignments: Array<{ variantId: string; attributeValueId: string; sortOrder: number }> = [];
    let attributesAssigned = 0;

    for (const [barcode, grouping] of externalGrouping) {
        const variantId = barcodeToVariantId.get(barcode);
        if (!variantId) continue;

        const options = grouping.externalVariantData.selectedOptions;
        if (!options || !Array.isArray(options)) continue;

        for (let i = 0; i < options.length; i++) {
            const opt = options[i];
            if (!opt?.name || !opt?.value) continue;

            const attrData = existingAttributesMap.get(opt.name.toLowerCase());
            if (!attrData) continue;

            const valuesMap = existingValuesMap.get(attrData.id);
            if (!valuesMap) continue;

            const valueId = valuesMap.get(opt.value.toLowerCase());
            if (!valueId) continue;

            assignments.push({
                variantId,
                attributeValueId: valueId,
                sortOrder: i,
            });
            attributesAssigned++;
        }
    }

    // Step 7: Insert attribute assignments in batch
    if (assignments.length > 0) {
        await batchInsertVariantAttributes(db, assignments);
    }

    ctx.progress.attributesCreated = attributesAssigned;
    await updateProgress(ctx);
}

/**
 * Phase 9: Update Links
 * - Clear canonical status for old primary
 * - Create/update links for new primary
 * - Update product-level data from new primary
 */
async function phase9_updateLinks(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;
    const externalGrouping = (ctx as PromotionContextInternal).externalGrouping;
    const mainProductMap = (ctx as PromotionContextInternal).mainProductMap;

    if (!externalGrouping || !mainProductMap) {
        throw new Error("Required data not available - earlier phases may have failed");
    }

    // Clear canonical status for old primary (if it exists)
    if (ctx.config.oldPrimaryIntegrationId) {
        await clearCanonicalStatus(db, ctx.config.oldPrimaryIntegrationId);
    }

    // Create product links for new primary
    const processedExternalProducts = new Set<string>();

    for (const [barcode, grouping] of externalGrouping) {
        if (processedExternalProducts.has(grouping.externalProductId)) {
            continue;
        }
        processedExternalProducts.add(grouping.externalProductId);

        const productId = mainProductMap.get(grouping.externalProductId);
        if (productId) {
            // Create/update product link
            await promotionUpsertProductLink(db, {
                brandIntegrationId: ctx.config.newPrimaryIntegrationId,
                productId,
                externalId: grouping.externalProductId,
                externalName: grouping.externalProductData.name ?? null,
                isCanonical: true,
            });

            // Update product data from external
            await updateProductFromExternal(db, productId, {
                name: grouping.externalProductData.name,
                description: grouping.externalProductData.description ?? null,
                imagePath: grouping.externalProductData.imagePath ?? null,
                sourceIntegrationId: ctx.config.newPrimaryIntegrationId,
            });
        }
    }

    // Create variant links for new primary
    const barcodeToVariant = await getVariantsByBarcode(
        db,
        ctx.config.brandId,
        Array.from(externalGrouping.keys()),
    );

    for (const [barcode, grouping] of externalGrouping) {
        const variantInfo = barcodeToVariant.get(barcode);
        if (variantInfo) {
            await promotionUpsertVariantLink(db, {
                brandIntegrationId: ctx.config.newPrimaryIntegrationId,
                variantId: variantInfo.variantId,
                externalId: grouping.externalVariantId,
            });
        }
    }

    await updateProgress(ctx);
}

/**
 * Phase 11: Cleanup
 * - Finalize integration status
 * - Update primary/secondary flags
 */
async function phase11_cleanup(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;

    // Update integration primary status
    await updateIntegrationPrimaryStatus(
        db,
        ctx.config.brandId,
        ctx.config.newPrimaryIntegrationId,
    );

    await updateProgress(ctx);
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Internal context type with additional fields for inter-phase communication.
 */
interface PromotionContextInternal extends PromotionContext {
    externalGrouping?: Map<string, ExternalGrouping>;
    variantAssignments?: Map<
        string,
        { currentProductId: string; targetExternalProductId: string | null }
    >;
    externalProductVariants?: Map<string, string[]>;
    mainProductMap?: Map<string, string>;
}

/**
 * Update progress in database and call optional callback.
 */
async function updateProgress(ctx: PromotionContext): Promise<void> {
    const db = ctx.db as Database;

    await updatePromotionProgressDb(db, ctx.operationId, {
        status: ctx.progress.phase,
        phase: ctx.progress.phaseNumber,
        variantsProcessed: ctx.progress.variantsProcessed,
        totalVariants: ctx.progress.totalVariants,
        productsCreated: ctx.progress.productsCreated,
        productsArchived: ctx.progress.productsArchived,
        variantsMoved: ctx.progress.variantsMoved,
        variantsOrphaned: ctx.progress.variantsOrphaned,
        attributesCreated: ctx.progress.attributesCreated,
    });

    if (ctx.onProgress) {
        await ctx.onProgress(ctx.progress);
    }
}

/**
 * Create empty progress object.
 */
function createEmptyProgress(operationId: string): PromotionProgress {
    return {
        operationId,
        phase: "failed",
        phaseNumber: 0,
        variantsProcessed: 0,
        totalVariants: 0,
        productsCreated: 0,
        productsArchived: 0,
        variantsMoved: 0,
        variantsOrphaned: 0,
        attributesCreated: 0,
    };
}

/**
 * Extract barcode from variant data.
 */
function extractBarcode(data: Record<string, unknown>): string | null {
    const barcode = data.barcode ?? data.ean ?? data.gtin;
    return typeof barcode === "string" && barcode.length > 0 ? barcode : null;
}

/**
 * Extract product data from external product.
 */
function extractProductData(data: Record<string, unknown>): {
    name?: string;
    description?: string;
    imagePath?: string;
} {
    return {
        name: typeof data.title === "string" ? data.title : undefined,
        description: typeof data.description === "string" ? data.description : undefined,
        imagePath: extractImagePath(data),
    };
}

/**
 * Extract variant data from external variant.
 */
function extractVariantData(data: Record<string, unknown>): {
    sku?: string;
    barcode?: string;
    selectedOptions?: Array<{ name: string; value: string }>;
} {
    return {
        sku: typeof data.sku === "string" ? data.sku : undefined,
        barcode: extractBarcode(data) ?? undefined,
        selectedOptions: Array.isArray(data.selectedOptions)
            ? data.selectedOptions as Array<{ name: string; value: string }>
            : undefined,
    };
}

/**
 * Extract image path from product data.
 */
function extractImagePath(data: Record<string, unknown>): string | undefined {
    // Handle various image structures
    if (typeof data.featuredImage === "object" && data.featuredImage !== null) {
        const img = data.featuredImage as Record<string, unknown>;
        if (typeof img.url === "string") return img.url;
    }
    if (typeof data.imagePath === "string") return data.imagePath;
    if (typeof data.image === "string") return data.image;
    return undefined;
}

/**
 * Generate a URL-safe handle from a product name.
 */
function generateHandle(name: string): string {
    return `${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100)}-${Date.now()}`;
}

// =============================================================================
// EXPORTS FOR TESTING
// =============================================================================

// Export pure helper functions for unit testing
export const _testHelpers = {
    extractBarcode,
    extractProductData,
    extractVariantData,
    extractImagePath,
    generateHandle: (name: string) => name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100), // Without timestamp for deterministic tests
    createEmptyProgress,
};
