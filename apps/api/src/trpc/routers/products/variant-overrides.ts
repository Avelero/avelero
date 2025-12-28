/**
 * Variant Overrides Router
 *
 * Manages variant-level data overrides for multi-source integration support.
 * All routes identify variants by productHandle + variantUpid (UPID), NOT by UUID.
 *
 * This router enables:
 * - Fetching fully resolved variant data (with inheritance)
 * - Updating individual override sections (core, commercial, environment, etc.)
 * - Clearing all overrides to reset inheritance
 *
 * Phase 4 implementation of the variant-level data override architecture.
 */
import { z } from "zod";
import { and, eq } from "@v1/db/queries";
import {
    products,
    productVariants,
    variantCommercial,
    variantEnvironment,
    variantEcoClaims,
    variantMaterials,
    variantWeight,
    variantJourneySteps,
} from "@v1/db/schema";
import {
    getVariantOverridesOnly,
    clearAllVariantOverrides,
    findVariantIdByUpid,
} from "@v1/db/queries/products";
import { revalidateProduct } from "../../../lib/dpp-revalidation.js";
import { badRequest, wrapError } from "../../../utils/errors.js";
import { createEntityResponse } from "../../../utils/response.js";
import type { AuthenticatedTRPCContext } from "../../init.js";
import { brandRequiredProcedure, createTRPCRouter } from "../../init.js";

type BrandContext = AuthenticatedTRPCContext & { brandId: string };
type BrandDb = BrandContext["db"];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Find variant ID by UPID and ensure it belongs to the active brand.
 * Throws if not found or not in brand scope.
 */
async function findVariantIdForBrand(
    db: BrandDb,
    brandId: string,
    productHandle: string,
    variantUpid: string
): Promise<{ variantId: string; productId: string }> {
    const [row] = await db
        .select({
            variantId: productVariants.id,
            productId: products.id,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.brandId, brandId),
                eq(products.productHandle, productHandle),
                eq(productVariants.upid, variantUpid)
            )
        )
        .limit(1);

    if (!row) {
        throw badRequest(
            "Variant not found for the active brand and product handle"
        );
    }

    return row;
}

// =============================================================================
// INPUT SCHEMAS
// =============================================================================

const variantIdentifierSchema = z.object({
    productHandle: z.string().min(1),
    variantUpid: z.string().min(1),
});

const updateCoreSchema = variantIdentifierSchema.extend({
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    imagePath: z.string().nullable().optional(),
});

const updateCommercialSchema = variantIdentifierSchema.extend({
    webshopUrl: z.string().url().nullable().optional(),
    price: z.string().nullable().optional(),
    currency: z.string().nullable().optional(),
    salesStatus: z.string().nullable().optional(),
});

const updateEnvironmentSchema = variantIdentifierSchema.extend({
    carbonKgCo2e: z.string().nullable().optional(),
    waterLiters: z.string().nullable().optional(),
});

const setMaterialsSchema = variantIdentifierSchema.extend({
    materials: z.array(
        z.object({
            brandMaterialId: z.string().uuid(),
            percentage: z.string().nullable().optional(),
        })
    ),
});

const setJourneySchema = variantIdentifierSchema.extend({
    steps: z.array(
        z.object({
            sortIndex: z.number().int().min(0),
            stepType: z.string().min(1),
            facilityId: z.string().uuid(),
        })
    ),
});

const setEcoClaimsSchema = variantIdentifierSchema.extend({
    ecoClaimIds: z.array(z.string().uuid()),
});

const updateWeightSchema = variantIdentifierSchema.extend({
    weight: z.string().nullable().optional(),
    weightUnit: z.string().nullable().optional(),
});

// =============================================================================
// ROUTER
// =============================================================================

export const variantOverridesRouter = createTRPCRouter({
    /**
     * Get variant-level overrides only (no inheritance).
     * Returns null for fields that inherit from product.
     * Looks up by UPID (public identifier).
     */
    get: brandRequiredProcedure
        .input(variantIdentifierSchema)
        .query(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            // Verify the variant belongs to the brand
            await findVariantIdForBrand(
                db,
                brandId,
                input.productHandle,
                input.variantUpid
            );

            // Get only override data (no inheritance from product)
            const overrides = await getVariantOverridesOnly(
                db,
                input.productHandle,
                input.variantUpid
            );

            if (!overrides) {
                throw badRequest("Variant not found");
            }

            return overrides;
        }),

    /**
     * Update variant core display (name, description, image).
     */
    updateCore: brandRequiredProcedure
        .input(updateCoreSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                // Build update payload with only provided fields
                const updatePayload: Record<string, unknown> = {};
                if (input.name !== undefined) updatePayload.name = input.name;
                if (input.description !== undefined)
                    updatePayload.description = input.description;
                if (input.imagePath !== undefined)
                    updatePayload.imagePath = input.imagePath;

                if (Object.keys(updatePayload).length > 0) {
                    updatePayload.updatedAt = new Date().toISOString();
                    await db
                        .update(productVariants)
                        .set(updatePayload)
                        .where(eq(productVariants.id, variantId));
                }

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({ success: true, variantId });
            } catch (error) {
                throw wrapError(error, "Failed to update variant core data");
            }
        }),

    /**
     * Update variant commercial data.
     */
    updateCommercial: brandRequiredProcedure
        .input(updateCommercialSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                // Check if record exists
                const [existing] = await db
                    .select({ variantId: variantCommercial.variantId })
                    .from(variantCommercial)
                    .where(eq(variantCommercial.variantId, variantId))
                    .limit(1);

                const now = new Date().toISOString();

                if (existing) {
                    // Update existing record
                    const updatePayload: Record<string, unknown> = { updatedAt: now };
                    if (input.webshopUrl !== undefined)
                        updatePayload.webshopUrl = input.webshopUrl;
                    if (input.price !== undefined) updatePayload.price = input.price;
                    if (input.currency !== undefined)
                        updatePayload.currency = input.currency;
                    if (input.salesStatus !== undefined)
                        updatePayload.salesStatus = input.salesStatus;

                    await db
                        .update(variantCommercial)
                        .set(updatePayload)
                        .where(eq(variantCommercial.variantId, variantId));
                } else {
                    // Insert new record
                    await db.insert(variantCommercial).values({
                        variantId,
                        webshopUrl: input.webshopUrl ?? null,
                        price: input.price ?? null,
                        currency: input.currency ?? null,
                        salesStatus: input.salesStatus ?? null,
                        createdAt: now,
                        updatedAt: now,
                    });
                }

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({ success: true, variantId });
            } catch (error) {
                throw wrapError(error, "Failed to update variant commercial data");
            }
        }),

    /**
     * Update variant environment data.
     */
    updateEnvironment: brandRequiredProcedure
        .input(updateEnvironmentSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                // Check if record exists
                const [existing] = await db
                    .select({ variantId: variantEnvironment.variantId })
                    .from(variantEnvironment)
                    .where(eq(variantEnvironment.variantId, variantId))
                    .limit(1);

                const now = new Date().toISOString();

                if (existing) {
                    // Update existing record
                    const updatePayload: Record<string, unknown> = { updatedAt: now };
                    if (input.carbonKgCo2e !== undefined)
                        updatePayload.carbonKgCo2e = input.carbonKgCo2e;
                    if (input.waterLiters !== undefined)
                        updatePayload.waterLiters = input.waterLiters;

                    await db
                        .update(variantEnvironment)
                        .set(updatePayload)
                        .where(eq(variantEnvironment.variantId, variantId));
                } else {
                    // Insert new record
                    await db.insert(variantEnvironment).values({
                        variantId,
                        carbonKgCo2e: input.carbonKgCo2e ?? null,
                        waterLiters: input.waterLiters ?? null,
                        createdAt: now,
                        updatedAt: now,
                    });
                }

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({ success: true, variantId });
            } catch (error) {
                throw wrapError(error, "Failed to update variant environment data");
            }
        }),

    /**
     * Replace variant materials (set empty array to clear and inherit from product).
     */
    setMaterials: brandRequiredProcedure
        .input(setMaterialsSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                await db.transaction(async (tx) => {
                    // Delete existing materials
                    await tx
                        .delete(variantMaterials)
                        .where(eq(variantMaterials.variantId, variantId));

                    // Insert new materials if any
                    if (input.materials.length > 0) {
                        const now = new Date().toISOString();
                        await tx.insert(variantMaterials).values(
                            input.materials.map((m) => ({
                                variantId,
                                brandMaterialId: m.brandMaterialId,
                                percentage: m.percentage ?? null,
                                createdAt: now,
                            }))
                        );
                    }
                });

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({
                    success: true,
                    variantId,
                    materialsCount: input.materials.length,
                });
            } catch (error) {
                throw wrapError(error, "Failed to set variant materials");
            }
        }),

    /**
     * Replace variant journey steps (set empty array to clear and inherit from product).
     */
    setJourney: brandRequiredProcedure
        .input(setJourneySchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                await db.transaction(async (tx) => {
                    // Delete existing journey steps
                    await tx
                        .delete(variantJourneySteps)
                        .where(eq(variantJourneySteps.variantId, variantId));

                    // Insert new journey steps if any
                    if (input.steps.length > 0) {
                        const now = new Date().toISOString();
                        await tx.insert(variantJourneySteps).values(
                            input.steps.map((s) => ({
                                variantId,
                                sortIndex: s.sortIndex,
                                stepType: s.stepType,
                                facilityId: s.facilityId,
                                createdAt: now,
                            }))
                        );
                    }
                });

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({
                    success: true,
                    variantId,
                    stepsCount: input.steps.length,
                });
            } catch (error) {
                throw wrapError(error, "Failed to set variant journey steps");
            }
        }),

    /**
     * Replace variant eco claims (set empty array to clear and inherit from product).
     */
    setEcoClaims: brandRequiredProcedure
        .input(setEcoClaimsSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                await db.transaction(async (tx) => {
                    // Delete existing eco claims
                    await tx
                        .delete(variantEcoClaims)
                        .where(eq(variantEcoClaims.variantId, variantId));

                    // Insert new eco claims if any
                    if (input.ecoClaimIds.length > 0) {
                        const now = new Date().toISOString();
                        await tx.insert(variantEcoClaims).values(
                            input.ecoClaimIds.map((ecoClaimId) => ({
                                variantId,
                                ecoClaimId,
                                createdAt: now,
                            }))
                        );
                    }
                });

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({
                    success: true,
                    variantId,
                    ecoClaimsCount: input.ecoClaimIds.length,
                });
            } catch (error) {
                throw wrapError(error, "Failed to set variant eco claims");
            }
        }),

    /**
     * Update variant weight data.
     */
    updateWeight: brandRequiredProcedure
        .input(updateWeightSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                // Check if record exists
                const [existing] = await db
                    .select({ variantId: variantWeight.variantId })
                    .from(variantWeight)
                    .where(eq(variantWeight.variantId, variantId))
                    .limit(1);

                const now = new Date().toISOString();

                if (existing) {
                    // Update existing record
                    const updatePayload: Record<string, unknown> = { updatedAt: now };
                    if (input.weight !== undefined) updatePayload.weight = input.weight;
                    if (input.weightUnit !== undefined)
                        updatePayload.weightUnit = input.weightUnit;

                    await db
                        .update(variantWeight)
                        .set(updatePayload)
                        .where(eq(variantWeight.variantId, variantId));
                } else {
                    // Insert new record
                    await db.insert(variantWeight).values({
                        variantId,
                        weight: input.weight ?? null,
                        weightUnit: input.weightUnit ?? null,
                        createdAt: now,
                        updatedAt: now,
                    });
                }

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({ success: true, variantId });
            } catch (error) {
                throw wrapError(error, "Failed to update variant weight data");
            }
        }),

    /**
     * Clear ALL overrides for a variant.
     * This resets the variant to inherit all data from the product level.
     */
    clearAll: brandRequiredProcedure
        .input(variantIdentifierSchema)
        .mutation(async ({ ctx, input }) => {
            const { db, brandId } = ctx as BrandContext;

            try {
                const { variantId } = await findVariantIdForBrand(
                    db,
                    brandId,
                    input.productHandle,
                    input.variantUpid
                );

                await clearAllVariantOverrides(db, variantId);

                // Revalidate DPP cache
                revalidateProduct(input.productHandle).catch(() => { });

                return createEntityResponse({ success: true, variantId });
            } catch (error) {
                throw wrapError(error, "Failed to clear variant overrides");
            }
        }),
});

export type VariantOverridesRouter = typeof variantOverridesRouter;
