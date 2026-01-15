/**
 * Product export query functions.
 *
 * Provides functions for loading complete product data for Excel export,
 * including all related entities (variants, materials, eco-claims, etc.)
 * with proper handling of variant-level overrides.
 *
 * @module products/export
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
    brandAttributes,
    brandAttributeValues,
    brandEcoClaims,
    brandFacilities,
    brandManufacturers,
    brandMaterials,
    brandSeasons,
    brandTags,
    taxonomyCategories,
    productEcoClaims,
    productEnvironment,
    productJourneySteps,
    productMaterials,
    productTags,
    productVariantAttributes,
    productVariants,
    products,
    productWeight,
    // Variant override tables
    variantEcoClaims,
    variantEnvironment,
    variantJourneySteps,
    variantMaterials,
    variantWeight,
} from "../../schema";
import { loadCategoryPathsForProducts } from "./_shared/helpers";

// ============================================================================
// Types
// ============================================================================

/**
 * Complete product data structured for Excel export.
 * Matches the format expected by excel-export-products.ts
 */
export interface ExportProductData {
    // Basic product info
    id: string;
    name: string;
    productHandle: string;
    description: string | null;
    manufacturerName: string | null;
    imagePath: string | null;
    status: string;
    categoryPath: string | null;
    seasonName: string | null;
    tags: string[]; // tag names for semicolon-join

    // Environmental
    carbonKg: number | null;
    waterLiters: number | null;

    // Eco-claims
    ecoClaims: string[]; // claim names for semicolon-join

    // Weight
    weightGrams: number | null;

    // Materials
    materials: Array<{ name: string; percentage: number | null }>;

    // Journey steps (stepType -> operatorName)
    journeySteps: Record<string, string>;

    // Variants
    variants: ExportVariantData[];
}

export interface ExportVariantData {
    upid: string;
    barcode: string | null;
    sku: string | null;
    attributes: Array<{ name: string; value: string; sortOrder: number }>;

    // Overrides (if any) - null means no override, use product-level
    nameOverride: string | null;
    descriptionOverride: string | null;
    imagePathOverride: string | null;
    carbonKgOverride: number | null;
    waterLitersOverride: number | null;
    weightGramsOverride: number | null;
    ecoClaimsOverride: string[] | null;
    materialsOverride: Array<{ name: string; percentage: number | null }> | null;
    journeyStepsOverride: Record<string, string> | null;
}

// ============================================================================
// Main Export Query
// ============================================================================

/**
 * Loads complete product data for export.
 *
 * Fetches all products matching the given IDs with all related data needed
 * for Excel export. Efficiently batch-loads related entities to avoid N+1 queries.
 *
 * @param db - Database instance
 * @param brandId - Brand ID for security validation
 * @param productIds - Array of product IDs to export
 * @returns Array of complete product data for export
 */
export async function getProductsForExport(
    db: Database,
    brandId: string,
    productIds: string[],
): Promise<ExportProductData[]> {
    if (productIds.length === 0) return [];

    // 1. Load base product data with joined names
    const productRows = await db
        .select({
            id: products.id,
            name: products.name,
            productHandle: products.productHandle,
            description: products.description,
            imagePath: products.imagePath,
            status: products.status,
            categoryId: products.categoryId,
            seasonId: products.seasonId,
            manufacturerId: products.manufacturerId,
            manufacturerName: brandManufacturers.name,
            seasonName: brandSeasons.name,
        })
        .from(products)
        .leftJoin(brandManufacturers, eq(products.manufacturerId, brandManufacturers.id))
        .leftJoin(brandSeasons, eq(products.seasonId, brandSeasons.id))
        .where(
            and(
                inArray(products.id, productIds),
                eq(products.brandId, brandId),
            ),
        );

    if (productRows.length === 0) return [];

    const productIdList = productRows.map((p) => p.id);
    const categoryIds = productRows
        .map((p) => p.categoryId)
        .filter((id): id is string => id !== null);

    // 2. Batch load all related data in parallel
    const [
        categoryPathsMap,
        tagsMap,
        environmentMap,
        ecoClaimsMap,
        weightMap,
        materialsMap,
        journeyMap,
        variantsWithData,
    ] = await Promise.all([
        loadCategoryPathsForProducts(db, categoryIds),
        loadTagsForProducts(db, productIdList),
        loadEnvironmentForProducts(db, productIdList),
        loadEcoClaimsForProducts(db, productIdList),
        loadWeightForProducts(db, productIdList),
        loadMaterialsForProducts(db, productIdList),
        loadJourneyForProducts(db, productIdList),
        loadVariantsWithOverrides(db, productIdList),
    ]);

    // 3. Assemble complete product data
    return productRows.map((product): ExportProductData => {
        const categoryPath = product.categoryId
            ? categoryPathsMap.get(product.categoryId)
            : null;

        const env = environmentMap.get(product.id);
        const weight = weightMap.get(product.id);

        return {
            id: product.id,
            name: product.name ?? "",
            productHandle: product.productHandle ?? "",
            description: product.description,
            manufacturerName: product.manufacturerName,
            imagePath: product.imagePath,
            status: product.status ?? "draft",
            categoryPath: categoryPath ? categoryPath.join(" > ") : null,
            seasonName: product.seasonName,
            tags: tagsMap.get(product.id) ?? [],
            carbonKg: env?.carbonKg ?? null,
            waterLiters: env?.waterLiters ?? null,
            ecoClaims: ecoClaimsMap.get(product.id) ?? [],
            weightGrams: weight ?? null,
            materials: materialsMap.get(product.id) ?? [],
            journeySteps: journeyMap.get(product.id) ?? {},
            variants: variantsWithData.get(product.id) ?? [],
        };
    });
}

// ============================================================================
// Helper Functions for Loading Related Data
// ============================================================================

async function loadTagsForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();

    const rows = await db
        .select({
            productId: productTags.productId,
            tagName: brandTags.name,
        })
        .from(productTags)
        .leftJoin(brandTags, eq(productTags.tagId, brandTags.id))
        .where(inArray(productTags.productId, productIds));

    for (const row of rows) {
        const tags = map.get(row.productId) ?? [];
        if (row.tagName) {
            tags.push(row.tagName);
        }
        map.set(row.productId, tags);
    }

    return map;
}

async function loadEnvironmentForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, { carbonKg: number | null; waterLiters: number | null }>> {
    const map = new Map<string, { carbonKg: number | null; waterLiters: number | null }>();

    const rows = await db
        .select({
            productId: productEnvironment.productId,
            metric: productEnvironment.metric,
            value: productEnvironment.value,
        })
        .from(productEnvironment)
        .where(inArray(productEnvironment.productId, productIds));

    for (const row of rows) {
        const env = map.get(row.productId) ?? { carbonKg: null, waterLiters: null };
        if (row.metric === "carbon_kg_co2e" && row.value) {
            env.carbonKg = parseFloat(row.value);
        } else if (row.metric === "water_liters" && row.value) {
            env.waterLiters = parseFloat(row.value);
        }
        map.set(row.productId, env);
    }

    return map;
}

async function loadEcoClaimsForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();

    const rows = await db
        .select({
            productId: productEcoClaims.productId,
            claimName: brandEcoClaims.claim,
        })
        .from(productEcoClaims)
        .leftJoin(brandEcoClaims, eq(productEcoClaims.ecoClaimId, brandEcoClaims.id))
        .where(inArray(productEcoClaims.productId, productIds));

    for (const row of rows) {
        const claims = map.get(row.productId) ?? [];
        if (row.claimName) {
            claims.push(row.claimName);
        }
        map.set(row.productId, claims);
    }

    return map;
}

async function loadWeightForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, number>> {
    const map = new Map<string, number>();

    const rows = await db
        .select({
            productId: productWeight.productId,
            weight: productWeight.weight,
            weightUnit: productWeight.weightUnit,
        })
        .from(productWeight)
        .where(inArray(productWeight.productId, productIds));

    for (const row of rows) {
        if (row.weight) {
            // Convert to grams if needed
            let grams = parseFloat(row.weight);
            if (row.weightUnit === "kg") {
                grams *= 1000;
            }
            map.set(row.productId, grams);
        }
    }

    return map;
}

async function loadMaterialsForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, Array<{ name: string; percentage: number | null }>>> {
    const map = new Map<string, Array<{ name: string; percentage: number | null }>>();

    const rows = await db
        .select({
            productId: productMaterials.productId,
            materialName: brandMaterials.name,
            percentage: productMaterials.percentage,
        })
        .from(productMaterials)
        .leftJoin(brandMaterials, eq(productMaterials.brandMaterialId, brandMaterials.id))
        .where(inArray(productMaterials.productId, productIds))
        .orderBy(asc(productMaterials.createdAt));

    for (const row of rows) {
        const materials = map.get(row.productId) ?? [];
        if (row.materialName) {
            materials.push({
                name: row.materialName,
                percentage: row.percentage ? parseFloat(row.percentage) : null,
            });
        }
        map.set(row.productId, materials);
    }

    return map;
}

async function loadJourneyForProducts(
    db: Database,
    productIds: string[],
): Promise<Map<string, Record<string, string>>> {
    const map = new Map<string, Record<string, string>>();

    const rows = await db
        .select({
            productId: productJourneySteps.productId,
            stepType: productJourneySteps.stepType,
            facilityName: brandFacilities.displayName,
        })
        .from(productJourneySteps)
        .leftJoin(brandFacilities, eq(productJourneySteps.facilityId, brandFacilities.id))
        .where(inArray(productJourneySteps.productId, productIds))
        .orderBy(asc(productJourneySteps.sortIndex));

    for (const row of rows) {
        const journey = map.get(row.productId) ?? {};
        if (row.stepType && row.facilityName) {
            journey[row.stepType] = row.facilityName;
        }
        map.set(row.productId, journey);
    }

    return map;
}

// ============================================================================
// Variant Loading with Overrides
// ============================================================================

async function loadVariantsWithOverrides(
    db: Database,
    productIds: string[],
): Promise<Map<string, ExportVariantData[]>> {
    const map = new Map<string, ExportVariantData[]>();
    if (productIds.length === 0) return map;

    // Load base variants
    const variantRows = await db
        .select({
            id: productVariants.id,
            productId: productVariants.productId,
            upid: productVariants.upid,
            barcode: productVariants.barcode,
            sku: productVariants.sku,
            name: productVariants.name,
            description: productVariants.description,
            imagePath: productVariants.imagePath,
        })
        .from(productVariants)
        .where(inArray(productVariants.productId, productIds))
        .orderBy(asc(productVariants.createdAt));

    if (variantRows.length === 0) return map;

    const variantIds = variantRows.map((v) => v.id);

    // Batch load all variant data in parallel
    const [
        attributesMap,
        envOverrideMap,
        weightOverrideMap,
        ecoClaimsOverrideMap,
        materialsOverrideMap,
        journeyOverrideMap,
    ] = await Promise.all([
        loadAttributesForVariants(db, variantIds),
        loadEnvOverridesForVariants(db, variantIds),
        loadWeightOverridesForVariants(db, variantIds),
        loadEcoClaimsOverridesForVariants(db, variantIds),
        loadMaterialsOverridesForVariants(db, variantIds),
        loadJourneyOverridesForVariants(db, variantIds),
    ]);

    // Assemble variant data
    for (const variant of variantRows) {
        const variants = map.get(variant.productId) ?? [];

        const envOverride = envOverrideMap.get(variant.id);
        const ecoClaimsOverride = ecoClaimsOverrideMap.get(variant.id);
        const materialsOverride = materialsOverrideMap.get(variant.id);
        const journeyOverride = journeyOverrideMap.get(variant.id);

        variants.push({
            upid: variant.upid ?? "",
            barcode: variant.barcode,
            sku: variant.sku,
            attributes: attributesMap.get(variant.id) ?? [],
            nameOverride: variant.name,
            descriptionOverride: variant.description,
            imagePathOverride: variant.imagePath,
            carbonKgOverride: envOverride?.carbonKg ?? null,
            waterLitersOverride: envOverride?.waterLiters ?? null,
            weightGramsOverride: weightOverrideMap.get(variant.id) ?? null,
            ecoClaimsOverride: ecoClaimsOverride && ecoClaimsOverride.length > 0 ? ecoClaimsOverride : null,
            materialsOverride: materialsOverride && materialsOverride.length > 0 ? materialsOverride : null,
            journeyStepsOverride: journeyOverride && Object.keys(journeyOverride).length > 0 ? journeyOverride : null,
        });

        map.set(variant.productId, variants);
    }

    return map;
}

async function loadAttributesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, Array<{ name: string; value: string; sortOrder: number }>>> {
    const map = new Map<string, Array<{ name: string; value: string; sortOrder: number }>>();

    const rows = await db
        .select({
            variantId: productVariantAttributes.variantId,
            attributeName: brandAttributes.name,
            valueName: brandAttributeValues.name,
            sortOrder: productVariantAttributes.sortOrder,
        })
        .from(productVariantAttributes)
        .innerJoin(brandAttributeValues, eq(productVariantAttributes.attributeValueId, brandAttributeValues.id))
        .innerJoin(brandAttributes, eq(brandAttributeValues.attributeId, brandAttributes.id))
        .where(inArray(productVariantAttributes.variantId, variantIds))
        .orderBy(asc(productVariantAttributes.sortOrder));

    for (const row of rows) {
        const attrs = map.get(row.variantId) ?? [];
        if (row.attributeName && row.valueName) {
            attrs.push({
                name: row.attributeName,
                value: row.valueName,
                sortOrder: row.sortOrder,
            });
        }
        map.set(row.variantId, attrs);
    }

    return map;
}

async function loadEnvOverridesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, { carbonKg: number | null; waterLiters: number | null }>> {
    const map = new Map<string, { carbonKg: number | null; waterLiters: number | null }>();

    const rows = await db
        .select({
            variantId: variantEnvironment.variantId,
            carbonKgCo2e: variantEnvironment.carbonKgCo2e,
            waterLiters: variantEnvironment.waterLiters,
        })
        .from(variantEnvironment)
        .where(inArray(variantEnvironment.variantId, variantIds));

    for (const row of rows) {
        map.set(row.variantId, {
            carbonKg: row.carbonKgCo2e ? parseFloat(row.carbonKgCo2e) : null,
            waterLiters: row.waterLiters ? parseFloat(row.waterLiters) : null,
        });
    }

    return map;
}

async function loadWeightOverridesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, number>> {
    const map = new Map<string, number>();

    const rows = await db
        .select({
            variantId: variantWeight.variantId,
            weight: variantWeight.weight,
            weightUnit: variantWeight.weightUnit,
        })
        .from(variantWeight)
        .where(inArray(variantWeight.variantId, variantIds));

    for (const row of rows) {
        if (row.weight) {
            let grams = parseFloat(row.weight);
            if (row.weightUnit === "kg") {
                grams *= 1000;
            }
            map.set(row.variantId, grams);
        }
    }

    return map;
}

async function loadEcoClaimsOverridesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();

    const rows = await db
        .select({
            variantId: variantEcoClaims.variantId,
            claimName: brandEcoClaims.claim,
        })
        .from(variantEcoClaims)
        .leftJoin(brandEcoClaims, eq(variantEcoClaims.ecoClaimId, brandEcoClaims.id))
        .where(inArray(variantEcoClaims.variantId, variantIds));

    for (const row of rows) {
        const claims = map.get(row.variantId) ?? [];
        if (row.claimName) {
            claims.push(row.claimName);
        }
        map.set(row.variantId, claims);
    }

    return map;
}

async function loadMaterialsOverridesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, Array<{ name: string; percentage: number | null }>>> {
    const map = new Map<string, Array<{ name: string; percentage: number | null }>>();

    const rows = await db
        .select({
            variantId: variantMaterials.variantId,
            materialName: brandMaterials.name,
            percentage: variantMaterials.percentage,
        })
        .from(variantMaterials)
        .leftJoin(brandMaterials, eq(variantMaterials.brandMaterialId, brandMaterials.id))
        .where(inArray(variantMaterials.variantId, variantIds))
        .orderBy(asc(variantMaterials.createdAt));

    for (const row of rows) {
        const materials = map.get(row.variantId) ?? [];
        if (row.materialName) {
            materials.push({
                name: row.materialName,
                percentage: row.percentage ? parseFloat(row.percentage) : null,
            });
        }
        map.set(row.variantId, materials);
    }

    return map;
}

async function loadJourneyOverridesForVariants(
    db: Database,
    variantIds: string[],
): Promise<Map<string, Record<string, string>>> {
    const map = new Map<string, Record<string, string>>();

    const rows = await db
        .select({
            variantId: variantJourneySteps.variantId,
            stepType: variantJourneySteps.stepType,
            facilityName: brandFacilities.displayName,
        })
        .from(variantJourneySteps)
        .leftJoin(brandFacilities, eq(variantJourneySteps.facilityId, brandFacilities.id))
        .where(inArray(variantJourneySteps.variantId, variantIds))
        .orderBy(asc(variantJourneySteps.sortIndex));

    for (const row of rows) {
        const journey = map.get(row.variantId) ?? {};
        if (row.stepType && row.facilityName) {
            journey[row.stepType] = row.facilityName;
        }
        map.set(row.variantId, journey);
    }

    return map;
}
