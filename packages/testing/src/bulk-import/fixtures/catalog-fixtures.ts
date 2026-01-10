/**
 * Catalog Fixtures for Bulk Import Tests
 *
 * Provides test data for brand catalogs (materials, seasons, categories, etc.)
 * These fixtures represent the pre-existing catalog data that imports resolve against.
 *
 * @module @v1/testing/bulk-import/fixtures/catalog-fixtures
 */

import type { InferInsertModel } from "drizzle-orm";
import * as schema from "@v1/db/schema";

// ============================================================================
// Types - Using actual schema table types
// ============================================================================

export type MaterialInsert = InferInsertModel<typeof schema.brandMaterials>;
export type SeasonInsert = InferInsertModel<typeof schema.brandSeasons>;
export type TagInsert = InferInsertModel<typeof schema.brandTags>;
export type FacilityInsert = InferInsertModel<typeof schema.brandFacilities>;
export type AttributeInsert = InferInsertModel<typeof schema.brandAttributes>;
export type AttributeValueInsert = InferInsertModel<typeof schema.brandAttributeValues>;
export type ManufacturerInsert = InferInsertModel<typeof schema.brandManufacturers>;
export type EcoClaimInsert = InferInsertModel<typeof schema.brandEcoClaims>;

/**
 * Complete catalog fixture set for a test brand
 * Note: Categories are not included as they come from taxonomy (not brand-level)
 */
export interface CatalogFixtures {
    materials: MaterialInsert[];
    seasons: SeasonInsert[];
    tags: TagInsert[];
    facilities: FacilityInsert[];
    attributes: AttributeInsert[];
    attributeValues: AttributeValueInsert[];
    manufacturers: ManufacturerInsert[];
    ecoClaims: EcoClaimInsert[];
}

// ============================================================================
// Fixture Generators
// ============================================================================

/**
 * Generate standard material fixtures for a brand
 */
export function createMaterialFixtures(brandId: string): MaterialInsert[] {
    return [
        { name: "Cotton", brandId },
        { name: "Polyester", brandId },
        { name: "Organic Cotton", brandId },
        { name: "Recycled Polyester", brandId },
        { name: "Elastane", brandId },
        { name: "Linen", brandId },
        { name: "Wool", brandId },
        { name: "Silk", brandId },
    ];
}

/**
 * Generate standard season fixtures for a brand
 */
export function createSeasonFixtures(brandId: string): SeasonInsert[] {
    return [
        { name: "NOS", brandId, ongoing: true },
        { name: "SS25", brandId },
        { name: "FW25", brandId },
        { name: "SS26", brandId },
        { name: "FW26", brandId },
    ];
}

/**
 * Generate standard tag fixtures for a brand
 */
export function createTagFixtures(brandId: string): TagInsert[] {
    return [
        { name: "Bestseller", brandId },
        { name: "New Arrival", brandId },
        { name: "Sale", brandId },
        { name: "Eco-Friendly", brandId },
        { name: "Limited Edition", brandId },
    ];
}

/**
 * Generate standard facility fixtures for a brand
 * Note: brandFacilities uses displayName, not name
 */
export function createFacilityFixtures(brandId: string): FacilityInsert[] {
    return [
        { displayName: "Cotton Farm Italy", brandId, countryCode: "IT" },
        { displayName: "Textile Mill Portugal", brandId, countryCode: "PT" },
        { displayName: "Dyeing Factory Spain", brandId, countryCode: "ES" },
        { displayName: "Stitching Workshop Poland", brandId, countryCode: "PL" },
        { displayName: "Assembly Plant Germany", brandId, countryCode: "DE" },
        { displayName: "Finishing Center Netherlands", brandId, countryCode: "NL" },
    ];
}

/**
 * Generate standard attribute fixtures for a brand
 */
export function createAttributeFixtures(brandId: string): AttributeInsert[] {
    return [
        { name: "Color", brandId },
        { name: "Size", brandId },
        { name: "Material", brandId },
    ];
}

/**
 * Generate standard attribute value fixtures
 * Note: Requires attribute IDs and brandId after attributes are inserted
 */
export function createAttributeValueFixtures(
    brandId: string,
    attributeIdMap: Record<string, string>
): AttributeValueInsert[] {
    const values: AttributeValueInsert[] = [];

    // Color values
    if (attributeIdMap["Color"]) {
        const colorValues = ["Red", "Blue", "Green", "Black", "White", "Navy"];
        colorValues.forEach((value) => {
            values.push({
                brandId,
                attributeId: attributeIdMap["Color"]!,
                name: value,
            });
        });
    }

    // Size values
    if (attributeIdMap["Size"]) {
        const sizeValues = ["XS", "S", "M", "L", "XL", "XXL"];
        sizeValues.forEach((value) => {
            values.push({
                brandId,
                attributeId: attributeIdMap["Size"]!,
                name: value,
            });
        });
    }

    return values;
}

/**
 * Generate standard manufacturer fixtures for a brand
 */
export function createManufacturerFixtures(brandId: string): ManufacturerInsert[] {
    return [
        { name: "Premium Textiles Co", brandId },
        { name: "Eco Fashion Manufacturing", brandId },
        { name: "European Garments Ltd", brandId },
    ];
}

/**
 * Generate standard eco claim fixtures for a brand
 * Note: brandEcoClaims uses claim, not name
 */
export function createEcoClaimFixtures(brandId: string): EcoClaimInsert[] {
    return [
        { claim: "GOTS Certified", brandId },
        { claim: "OEKO-TEX Standard 100", brandId },
        { claim: "Fair Trade", brandId },
        { claim: "Organic", brandId },
        { claim: "Recycled Content", brandId },
    ];
}

/**
 * Create a complete set of catalog fixtures for a test brand
 * Note: attributeValues requires a second pass after attributes are inserted
 */
export function createFullCatalogFixtures(brandId: string): Omit<CatalogFixtures, "attributeValues"> {
    return {
        materials: createMaterialFixtures(brandId),
        seasons: createSeasonFixtures(brandId),
        tags: createTagFixtures(brandId),
        facilities: createFacilityFixtures(brandId),
        attributes: createAttributeFixtures(brandId),
        manufacturers: createManufacturerFixtures(brandId),
        ecoClaims: createEcoClaimFixtures(brandId),
    };
}

// ============================================================================
// Pre-defined Fixture Sets
// ============================================================================

/**
 * Minimal catalog - just the essentials for basic import tests
 */
export function createMinimalCatalogFixtures(brandId: string): Omit<CatalogFixtures, "attributeValues"> {
    return {
        materials: [{ name: "Cotton", brandId }],
        seasons: [{ name: "NOS", brandId, ongoing: true }],
        tags: [],
        facilities: [],
        attributes: [{ name: "Size", brandId }],
        manufacturers: [{ name: "Test Manufacturer", brandId }],
        ecoClaims: [],
    };
}

/**
 * Empty catalog - for testing CREATE_AND_ENRICH mode where entities are auto-created
 * Note: Categories are never auto-created in imports
 */
export function createEmptyCatalogFixtures(): Omit<CatalogFixtures, "attributeValues"> {
    return {
        materials: [],
        seasons: [],
        tags: [],
        facilities: [],
        attributes: [],
        manufacturers: [],
        ecoClaims: [],
    };
}
