/**
 * Variant Data Resolution Layer
 *
 * Resolves variant data by checking variant-level overrides first,
 * then falling back to product-level data.
 *
 * This module is the core of the multi-source integration solution,
 * providing transparent data resolution for DPP rendering and API responses.
 */

import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
    products,
    productVariants,
    productCommercial,
    productEnvironment,
    productMaterials,
    productWeight,
    productJourneySteps,
    productEcoClaims,
    variantCommercial,
    variantEnvironment,
    variantMaterials,
    variantWeight,
    variantJourneySteps,
    variantEcoClaims,
    brandMaterials,
    brandFacilities,
    brandEcoClaims,
} from "../../schema";

// =============================================================================
// RESOLVED DATA TYPES
// =============================================================================

/**
 * Resolved commercial data (variant ?? product)
 */
export interface ResolvedCommercial {
    webshopUrl: string | null;
    price: string | null;
    currency: string | null;
    salesStatus: string | null;
    source: "variant" | "product" | null;
}

/**
 * Resolved environment data (variant ?? product)
 */
export interface ResolvedEnvironment {
    carbonKgCo2e: string | null;
    waterLiters: string | null;
    source: "variant" | "product";
}

/**
 * Resolved eco claim entry
 */
export interface ResolvedEcoClaim {
    ecoClaimId: string;
    claim: string;
}

/**
 * Resolved material entry
 */
export interface ResolvedMaterial {
    brandMaterialId: string;
    materialName: string;
    percentage: string | null;
}

/**
 * Resolved weight data (variant ?? product)
 */
export interface ResolvedWeight {
    weight: string | null;
    weightUnit: string | null;
    source: "variant" | "product";
}

/**
 * Resolved journey step entry
 */
export interface ResolvedJourneyStep {
    sortIndex: number;
    stepType: string;
    facilityId: string;
    facilityName: string | null;
}

/**
 * Fully resolved variant data with inheritance from product.
 * This is the main output of the resolution layer.
 */
export interface ResolvedVariantData {
    // Identity
    variantId: string;
    variantUpid: string | null;
    productId: string;
    productHandle: string;
    brandId: string;

    // Core display (resolved: variant ?? product)
    name: string;
    description: string | null;
    imagePath: string | null;

    // Commercial (resolved)
    commercial: ResolvedCommercial;

    // Environment (resolved)
    environment: ResolvedEnvironment | null;

    // Eco claims (variant-level if ANY exist, else product-level)
    ecoClaims: ResolvedEcoClaim[];

    // Materials (variant-level if ANY exist, else product-level)
    materials: ResolvedMaterial[];

    // Weight (resolved)
    weight: ResolvedWeight | null;

    // Journey (variant-level if ANY exist, else product-level)
    journey: ResolvedJourneyStep[];

    // Metadata
    hasOverrides: boolean;
    overriddenSections: string[];
    sourceIntegration: string | null;
    sourceExternalId: string | null;
}

// =============================================================================
// CORE RESOLUTION FUNCTIONS
// =============================================================================

/**
 * Resolve all variant data with inheritance.
 * Looks up by UPID (public identifier), not UUID.
 *
 * @param db - Database instance
 * @param productHandle - Product handle (URL-friendly identifier)
 * @param variantUpid - Variant UPID (16-char alphanumeric)
 * @returns Resolved variant data or null if not found
 */
export async function resolveVariantDataByUpid(
    db: Database,
    productHandle: string,
    variantUpid: string,
): Promise<ResolvedVariantData | null> {
    // Find variant by UPID
    const [variant] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.productHandle, productHandle),
                eq(productVariants.upid, variantUpid),
            ),
        )
        .limit(1);

    if (!variant) return null;

    return resolveVariantDataById(db, variant.id);
}

/**
 * Resolve variant data by internal UUID.
 *
 * @param db - Database instance
 * @param variantId - Variant UUID
 * @returns Resolved variant data or null if not found
 */
export async function resolveVariantDataById(
    db: Database,
    variantId: string,
): Promise<ResolvedVariantData | null> {
    // Fetch all data in parallel for performance
    const [
        coreData,
        variantCommercialData,
        productCommercialData,
        variantEnvData,
        productEnvData,
        variantEcoClaimsData,
        productEcoClaimsData,
        variantMaterialsData,
        productMaterialsData,
        variantWeightData,
        productWeightData,
        variantJourneyData,
        productJourneyData,
    ] = await Promise.all([
        fetchCoreVariantData(db, variantId),
        fetchVariantCommercial(db, variantId),
        null as Awaited<ReturnType<typeof fetchProductCommercial>> | null, // Placeholder, will be fetched after
        fetchVariantEnvironment(db, variantId),
        null as Awaited<ReturnType<typeof fetchProductEnvironment>> | null,
        fetchVariantEcoClaims(db, variantId),
        null as ResolvedEcoClaim[] | null,
        fetchVariantMaterials(db, variantId),
        null as ResolvedMaterial[] | null,
        fetchVariantWeight(db, variantId),
        null as Awaited<ReturnType<typeof fetchProductWeight>> | null,
        fetchVariantJourney(db, variantId),
        null as ResolvedJourneyStep[] | null,
    ]);

    if (!coreData) return null;

    // Now fetch product-level data using the productId from coreData
    const [
        productCommercialDataFetched,
        productEnvDataFetched,
        productEcoClaimsDataFetched,
        productMaterialsDataFetched,
        productWeightDataFetched,
        productJourneyDataFetched,
    ] = await Promise.all([
        fetchProductCommercial(db, coreData.productId),
        fetchProductEnvironment(db, coreData.productId),
        fetchProductEcoClaims(db, coreData.productId),
        fetchProductMaterials(db, coreData.productId),
        fetchProductWeight(db, coreData.productId),
        fetchProductJourney(db, coreData.productId),
    ]);

    // Track which sections have overrides
    const overriddenSections: string[] = [];

    // Core display: variant columns ?? product columns
    const name = coreData.variantName ?? coreData.productName;
    const description = coreData.variantDescription ?? coreData.productDescription;
    const imagePath = coreData.variantImagePath ?? coreData.productImagePath;

    if (
        coreData.variantName ||
        coreData.variantDescription ||
        coreData.variantImagePath
    ) {
        overriddenSections.push("basicInfo");
    }

    // Commercial: check if variant-level exists
    let commercial: ResolvedCommercial;
    if (variantCommercialData) {
        commercial = {
            webshopUrl: variantCommercialData.webshopUrl,
            price: variantCommercialData.price,
            currency: variantCommercialData.currency,
            salesStatus: variantCommercialData.salesStatus,
            source: "variant",
        };
        overriddenSections.push("commercial");
    } else if (productCommercialDataFetched) {
        commercial = {
            webshopUrl: productCommercialDataFetched.webshopUrl,
            price: productCommercialDataFetched.price,
            currency: productCommercialDataFetched.currency,
            salesStatus: productCommercialDataFetched.salesStatus,
            source: "product",
        };
    } else {
        commercial = {
            webshopUrl: null,
            price: null,
            currency: null,
            salesStatus: null,
            source: null,
        };
    }

    // Environment: check if variant-level exists
    let environment: ResolvedEnvironment | null = null;
    if (variantEnvData) {
        environment = {
            carbonKgCo2e: variantEnvData.carbonKgCo2e,
            waterLiters: variantEnvData.waterLiters,
            source: "variant",
        };
        overriddenSections.push("environment");
    } else if (productEnvDataFetched) {
        environment = {
            carbonKgCo2e: productEnvDataFetched.carbonKgCo2e,
            waterLiters: productEnvDataFetched.waterLiters,
            source: "product",
        };
    }

    // Eco claims: use variant-level if ANY exist, else product-level
    const ecoClaims =
        variantEcoClaimsData.length > 0
            ? variantEcoClaimsData
            : productEcoClaimsDataFetched;
    if (variantEcoClaimsData.length > 0) {
        overriddenSections.push("ecoClaims");
    }

    // Materials: use variant-level if ANY exist, else product-level
    const materials =
        variantMaterialsData.length > 0
            ? variantMaterialsData
            : productMaterialsDataFetched;
    if (variantMaterialsData.length > 0) {
        overriddenSections.push("materials");
    }

    // Weight: check if variant-level exists
    let weight: ResolvedWeight | null = null;
    if (variantWeightData) {
        weight = {
            weight: variantWeightData.weight,
            weightUnit: variantWeightData.weightUnit,
            source: "variant",
        };
        overriddenSections.push("weight");
    } else if (productWeightDataFetched) {
        weight = {
            weight: productWeightDataFetched.weight,
            weightUnit: productWeightDataFetched.weightUnit,
            source: "product",
        };
    }

    // Journey: use variant-level if ANY exist, else product-level
    const journey =
        variantJourneyData.length > 0
            ? variantJourneyData
            : productJourneyDataFetched;
    if (variantJourneyData.length > 0) {
        overriddenSections.push("journey");
    }

    return {
        variantId,
        variantUpid: coreData.variantUpid,
        productId: coreData.productId,
        productHandle: coreData.productHandle,
        brandId: coreData.brandId,
        name,
        description,
        imagePath,
        commercial,
        environment,
        ecoClaims,
        materials,
        weight,
        journey,
        hasOverrides: overriddenSections.length > 0,
        overriddenSections,
        sourceIntegration: coreData.variantSourceIntegration,
        sourceExternalId: coreData.variantSourceExternalId,
    };
}

// =============================================================================
// INTERNAL FETCH FUNCTIONS
// =============================================================================

/**
 * Fetch core variant and product data.
 */
async function fetchCoreVariantData(db: Database, variantId: string) {
    const [row] = await db
        .select({
            variantId: productVariants.id,
            variantUpid: productVariants.upid,
            variantName: productVariants.name,
            variantDescription: productVariants.description,
            variantImagePath: productVariants.imagePath,
            variantSourceIntegration: productVariants.sourceIntegration,
            variantSourceExternalId: productVariants.sourceExternalId,
            productId: products.id,
            productHandle: products.productHandle,
            productName: products.name,
            productDescription: products.description,
            productImagePath: products.imagePath,
            brandId: products.brandId,
        })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(eq(productVariants.id, variantId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch variant commercial data.
 */
async function fetchVariantCommercial(db: Database, variantId: string) {
    const [row] = await db
        .select({
            webshopUrl: variantCommercial.webshopUrl,
            price: variantCommercial.price,
            currency: variantCommercial.currency,
            salesStatus: variantCommercial.salesStatus,
        })
        .from(variantCommercial)
        .where(eq(variantCommercial.variantId, variantId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch product commercial data.
 */
async function fetchProductCommercial(db: Database, productId: string) {
    const [row] = await db
        .select({
            webshopUrl: productCommercial.webshopUrl,
            price: productCommercial.price,
            currency: productCommercial.currency,
            salesStatus: productCommercial.salesStatus,
        })
        .from(productCommercial)
        .where(eq(productCommercial.productId, productId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch variant environment data.
 */
async function fetchVariantEnvironment(db: Database, variantId: string) {
    const [row] = await db
        .select({
            carbonKgCo2e: variantEnvironment.carbonKgCo2e,
            waterLiters: variantEnvironment.waterLiters,
        })
        .from(variantEnvironment)
        .where(eq(variantEnvironment.variantId, variantId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch product environment data (normalized from metric-keyed rows).
 */
async function fetchProductEnvironment(db: Database, productId: string) {
    const rows = await db
        .select({
            value: productEnvironment.value,
            metric: productEnvironment.metric,
        })
        .from(productEnvironment)
        .where(eq(productEnvironment.productId, productId));

    if (rows.length === 0) return null;

    const carbonRow = rows.find((r) => r.metric === "carbon_kg_co2e");
    const waterRow = rows.find((r) => r.metric === "water_liters");

    return {
        carbonKgCo2e: carbonRow?.value ?? null,
        waterLiters: waterRow?.value ?? null,
    };
}

/**
 * Fetch variant eco claims.
 */
async function fetchVariantEcoClaims(
    db: Database,
    variantId: string,
): Promise<ResolvedEcoClaim[]> {
    const rows = await db
        .select({
            ecoClaimId: variantEcoClaims.ecoClaimId,
            claim: brandEcoClaims.claim,
        })
        .from(variantEcoClaims)
        .innerJoin(brandEcoClaims, eq(brandEcoClaims.id, variantEcoClaims.ecoClaimId))
        .where(eq(variantEcoClaims.variantId, variantId));

    return rows.map((r) => ({ ecoClaimId: r.ecoClaimId, claim: r.claim }));
}

/**
 * Fetch product eco claims.
 */
async function fetchProductEcoClaims(
    db: Database,
    productId: string,
): Promise<ResolvedEcoClaim[]> {
    const rows = await db
        .select({
            ecoClaimId: productEcoClaims.ecoClaimId,
            claim: brandEcoClaims.claim,
        })
        .from(productEcoClaims)
        .innerJoin(brandEcoClaims, eq(brandEcoClaims.id, productEcoClaims.ecoClaimId))
        .where(eq(productEcoClaims.productId, productId));

    return rows.map((r) => ({ ecoClaimId: r.ecoClaimId, claim: r.claim }));
}

/**
 * Fetch variant materials.
 */
async function fetchVariantMaterials(
    db: Database,
    variantId: string,
): Promise<ResolvedMaterial[]> {
    const rows = await db
        .select({
            brandMaterialId: variantMaterials.brandMaterialId,
            materialName: brandMaterials.name,
            percentage: variantMaterials.percentage,
        })
        .from(variantMaterials)
        .innerJoin(
            brandMaterials,
            eq(brandMaterials.id, variantMaterials.brandMaterialId),
        )
        .where(eq(variantMaterials.variantId, variantId));

    return rows.map((r) => ({
        brandMaterialId: r.brandMaterialId,
        materialName: r.materialName,
        percentage: r.percentage,
    }));
}

/**
 * Fetch product materials.
 */
async function fetchProductMaterials(
    db: Database,
    productId: string,
): Promise<ResolvedMaterial[]> {
    const rows = await db
        .select({
            brandMaterialId: productMaterials.brandMaterialId,
            materialName: brandMaterials.name,
            percentage: productMaterials.percentage,
        })
        .from(productMaterials)
        .innerJoin(
            brandMaterials,
            eq(brandMaterials.id, productMaterials.brandMaterialId),
        )
        .where(eq(productMaterials.productId, productId))
        .orderBy(asc(productMaterials.createdAt));

    return rows.map((r) => ({
        brandMaterialId: r.brandMaterialId,
        materialName: r.materialName,
        percentage: r.percentage,
    }));
}

/**
 * Fetch variant weight.
 */
async function fetchVariantWeight(db: Database, variantId: string) {
    const [row] = await db
        .select({
            weight: variantWeight.weight,
            weightUnit: variantWeight.weightUnit,
        })
        .from(variantWeight)
        .where(eq(variantWeight.variantId, variantId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch product weight.
 */
async function fetchProductWeight(db: Database, productId: string) {
    const [row] = await db
        .select({
            weight: productWeight.weight,
            weightUnit: productWeight.weightUnit,
        })
        .from(productWeight)
        .where(eq(productWeight.productId, productId))
        .limit(1);

    return row ?? null;
}

/**
 * Fetch variant journey steps.
 */
async function fetchVariantJourney(
    db: Database,
    variantId: string,
): Promise<ResolvedJourneyStep[]> {
    const rows = await db
        .select({
            sortIndex: variantJourneySteps.sortIndex,
            stepType: variantJourneySteps.stepType,
            facilityId: variantJourneySteps.facilityId,
            facilityName: brandFacilities.displayName,
        })
        .from(variantJourneySteps)
        .innerJoin(
            brandFacilities,
            eq(brandFacilities.id, variantJourneySteps.facilityId),
        )
        .where(eq(variantJourneySteps.variantId, variantId))
        .orderBy(asc(variantJourneySteps.sortIndex));

    return rows.map((r) => ({
        sortIndex: r.sortIndex,
        stepType: r.stepType,
        facilityId: r.facilityId,
        facilityName: r.facilityName,
    }));
}

/**
 * Fetch product journey steps.
 */
async function fetchProductJourney(
    db: Database,
    productId: string,
): Promise<ResolvedJourneyStep[]> {
    const rows = await db
        .select({
            sortIndex: productJourneySteps.sortIndex,
            stepType: productJourneySteps.stepType,
            facilityId: productJourneySteps.facilityId,
            facilityName: brandFacilities.displayName,
        })
        .from(productJourneySteps)
        .innerJoin(
            brandFacilities,
            eq(brandFacilities.id, productJourneySteps.facilityId),
        )
        .where(eq(productJourneySteps.productId, productId))
        .orderBy(asc(productJourneySteps.sortIndex));

    return rows.map((r) => ({
        sortIndex: r.sortIndex,
        stepType: r.stepType,
        facilityId: r.facilityId,
        facilityName: r.facilityName,
    }));
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Clear all overrides for a variant (all tables).
 * Resets the variant to inherit all data from product level.
 *
 * @param db - Database instance
 * @param variantId - Variant UUID
 */
export async function clearAllVariantOverrides(
    db: Database,
    variantId: string,
): Promise<void> {
    await Promise.all([
        // Clear columns on product_variants
        db
            .update(productVariants)
            .set({
                name: null,
                description: null,
                imagePath: null,
                sourceIntegration: null,
                sourceExternalId: null,
            })
            .where(eq(productVariants.id, variantId)),
        // Delete from variant tables
        db.delete(variantCommercial).where(eq(variantCommercial.variantId, variantId)),
        db.delete(variantEnvironment).where(eq(variantEnvironment.variantId, variantId)),
        db.delete(variantEcoClaims).where(eq(variantEcoClaims.variantId, variantId)),
        db.delete(variantMaterials).where(eq(variantMaterials.variantId, variantId)),
        db.delete(variantWeight).where(eq(variantWeight.variantId, variantId)),
        db.delete(variantJourneySteps).where(eq(variantJourneySteps.variantId, variantId)),
    ]);
}

/**
 * Check if a variant has any overrides.
 *
 * @param db - Database instance
 * @param variantId - Variant UUID
 * @returns true if the variant has any override data
 */
export async function variantHasOverrides(
    db: Database,
    variantId: string,
): Promise<boolean> {
    // Check variant core columns first
    const [variant] = await db
        .select({
            name: productVariants.name,
            description: productVariants.description,
            imagePath: productVariants.imagePath,
        })
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);

    if (!variant) return false;

    if (variant.name || variant.description || variant.imagePath) {
        return true;
    }

    // Check override tables
    const [
        hasCommercial,
        hasEnvironment,
        hasEcoClaims,
        hasMaterials,
        hasWeight,
        hasJourney,
    ] = await Promise.all([
        db
            .select({ id: variantCommercial.variantId })
            .from(variantCommercial)
            .where(eq(variantCommercial.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
        db
            .select({ id: variantEnvironment.variantId })
            .from(variantEnvironment)
            .where(eq(variantEnvironment.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
        db
            .select({ id: variantEcoClaims.id })
            .from(variantEcoClaims)
            .where(eq(variantEcoClaims.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
        db
            .select({ id: variantMaterials.id })
            .from(variantMaterials)
            .where(eq(variantMaterials.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
        db
            .select({ id: variantWeight.variantId })
            .from(variantWeight)
            .where(eq(variantWeight.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
        db
            .select({ id: variantJourneySteps.id })
            .from(variantJourneySteps)
            .where(eq(variantJourneySteps.variantId, variantId))
            .limit(1)
            .then((r) => r.length > 0),
    ]);

    return (
        hasCommercial ||
        hasEnvironment ||
        hasEcoClaims ||
        hasMaterials ||
        hasWeight ||
        hasJourney
    );
}

/**
 * Helper to find variant ID by UPID within a product.
 *
 * @param db - Database instance
 * @param productHandle - Product handle
 * @param variantUpid - Variant UPID
 * @returns Variant UUID or null
 */
export async function findVariantIdByUpid(
    db: Database,
    productHandle: string,
    variantUpid: string,
): Promise<string | null> {
    const [row] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.productHandle, productHandle),
                eq(productVariants.upid, variantUpid),
            ),
        )
        .limit(1);

    return row?.id ?? null;
}

// =============================================================================
// OVERRIDE-ONLY DATA (FOR FORM EDITING)
// =============================================================================

/**
 * Variant override data - only the variant-specific values, NO inheritance.
 * Used for form editing where empty = inherit from product.
 */
export interface VariantOverrideData {
    variantId: string;
    variantUpid: string | null;
    productId: string;
    productHandle: string;
    brandId: string;

    // Core display overrides (null = inherit from product)
    name: string | null;
    description: string | null;
    imagePath: string | null;

    // Environment overrides (null = inherit from product)
    environment: {
        carbonKgCo2e: string | null;
        waterLiters: string | null;
    } | null;

    // Eco claims (empty array = inherit from product)
    ecoClaims: ResolvedEcoClaim[];

    // Materials (empty array = inherit from product)
    materials: ResolvedMaterial[];

    // Journey (empty array = inherit from product)
    journey: ResolvedJourneyStep[];

    // Metadata
    hasOverrides: boolean;
    overriddenSections: string[];
}

/**
 * Get ONLY variant-level overrides without product inheritance.
 * Returns null for fields that inherit from product.
 * Used for the variant edit form.
 *
 * @param db - Database instance
 * @param productHandle - Product handle
 * @param variantUpid - Variant UPID
 * @returns Override data or null if variant not found
 */
export async function getVariantOverridesOnly(
    db: Database,
    productHandle: string,
    variantUpid: string,
): Promise<VariantOverrideData | null> {
    // Find variant by UPID
    const [variant] = await db
        .select({ id: productVariants.id })
        .from(productVariants)
        .innerJoin(products, eq(products.id, productVariants.productId))
        .where(
            and(
                eq(products.productHandle, productHandle),
                eq(productVariants.upid, variantUpid),
            ),
        )
        .limit(1);

    if (!variant) return null;

    return getVariantOverridesOnlyById(db, variant.id);
}

/**
 * Get ONLY variant-level overrides by variant UUID.
 *
 * @param db - Database instance
 * @param variantId - Variant UUID
 * @returns Override data or null if variant not found
 */
export async function getVariantOverridesOnlyById(
    db: Database,
    variantId: string,
): Promise<VariantOverrideData | null> {
    // Fetch only variant-level data (no product-level)
    const [
        coreData,
        variantEnvData,
        variantEcoClaimsData,
        variantMaterialsData,
        variantJourneyData,
    ] = await Promise.all([
        fetchCoreVariantData(db, variantId),
        fetchVariantEnvironment(db, variantId),
        fetchVariantEcoClaims(db, variantId),
        fetchVariantMaterials(db, variantId),
        fetchVariantJourney(db, variantId),
    ]);

    if (!coreData) return null;

    // Track which sections have overrides
    const overriddenSections: string[] = [];

    // Check for basic info overrides
    if (
        coreData.variantName ||
        coreData.variantDescription ||
        coreData.variantImagePath
    ) {
        overriddenSections.push("basicInfo");
    }

    // Check environment overrides
    if (variantEnvData) {
        overriddenSections.push("environment");
    }

    // Check eco claims overrides
    if (variantEcoClaimsData.length > 0) {
        overriddenSections.push("ecoClaims");
    }

    // Check materials overrides
    if (variantMaterialsData.length > 0) {
        overriddenSections.push("materials");
    }

    // Check journey overrides
    if (variantJourneyData.length > 0) {
        overriddenSections.push("journey");
    }

    return {
        variantId,
        variantUpid: coreData.variantUpid,
        productId: coreData.productId,
        productHandle: coreData.productHandle,
        brandId: coreData.brandId,

        // Core display - return the variant-specific values (null if not overridden)
        name: coreData.variantName,
        description: coreData.variantDescription,
        imagePath: coreData.variantImagePath,

        // Environment - return variant-level only (null if not overridden)
        environment: variantEnvData,

        // List data - empty array means inherit from product
        ecoClaims: variantEcoClaimsData,
        materials: variantMaterialsData,
        journey: variantJourneyData,

        hasOverrides: overriddenSections.length > 0,
        overriddenSections,
    };
}

