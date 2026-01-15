/**
 * Test Catalog Utility for Bulk Import Tests
 *
 * Sets up brand catalog data (materials, seasons, facilities, etc.)
 * for integration tests. Provides a realistic catalog that imports
 * can resolve against.
 *
 * @module @v1/testing/bulk-import/test-catalog
 */

import type { Database } from "../../client";
import * as schema from "../../schema/index";
import {
    createFullCatalogFixtures,
    createMinimalCatalogFixtures,
    createEmptyCatalogFixtures,
    createAttributeValueFixtures,
    type CatalogFixtures,
} from "./fixtures/catalog-fixtures";

// ============================================================================
// Types
// ============================================================================

export interface TestCatalogOptions {
    /** Brand ID to create catalog for (required) */
    brandId: string;
    /** Use minimal catalog (only essentials) */
    minimal?: boolean;
    /** Use empty catalog (for testing auto-creation) */
    empty?: boolean;
    /** Custom materials to add/override */
    materials?: string[];
    /** Custom seasons to add/override */
    seasons?: string[];
    /** Custom attributes with values */
    attributes?: Array<{ name: string; values: string[] }>;
    /** Custom facilities to add (uses displayName) */
    facilities?: string[];
    /** Custom tags to add */
    tags?: string[];
    /** Custom eco claims to add (uses claim) */
    ecoClaims?: string[];
    /** Custom manufacturers to add */
    manufacturers?: string[];
}

export interface InsertedCatalog {
    materials: Map<string, string>; // name -> id
    seasons: Map<string, string>;
    tags: Map<string, string>;
    facilities: Map<string, string>; // displayName -> id
    attributes: Map<string, string>;
    attributeValues: Map<string, string>; // "attributeName:valueName" -> id
    manufacturers: Map<string, string>;
    ecoClaims: Map<string, string>; // claim -> id
}

// ============================================================================
// Test Catalog Class
// ============================================================================

/**
 * Utility for setting up test brand catalog data.
 *
 * @example
 * ```typescript
 * // Setup a full catalog for a test brand
 * const catalog = await TestCatalog.setup(db, { brandId });
 *
 * // Access inserted IDs
 * const cottonId = catalog.materials.get("Cotton");
 * const sizeAttrId = catalog.attributes.get("Size");
 *
 * // Cleanup after test
 * await TestCatalog.cleanup(db, brandId);
 * ```
 */
export class TestCatalog {
    /**
     * Setup a test catalog for a brand
     */
    static async setup(
        db: Database,
        options: TestCatalogOptions
    ): Promise<InsertedCatalog> {
        const { brandId, minimal = false, empty = false } = options;

        // Determine base fixtures
        let fixtures: Omit<CatalogFixtures, "attributeValues">;
        if (empty) {
            fixtures = createEmptyCatalogFixtures();
        } else if (minimal) {
            fixtures = createMinimalCatalogFixtures(brandId);
        } else {
            fixtures = createFullCatalogFixtures(brandId);
        }

        // Apply custom overrides
        if (options.materials?.length) {
            fixtures.materials = options.materials.map((name) => ({
                name,
                brandId,
            }));
        }
        if (options.seasons?.length) {
            fixtures.seasons = options.seasons.map((name) => ({
                name,
                brandId,
            }));
        }
        if (options.tags?.length) {
            fixtures.tags = options.tags.map((name) => ({ name, brandId }));
        }
        if (options.facilities?.length) {
            fixtures.facilities = options.facilities.map((displayName) => ({
                displayName,
                brandId,
            }));
        }
        if (options.manufacturers?.length) {
            fixtures.manufacturers = options.manufacturers.map((name) => ({
                name,
                brandId,
            }));
        }
        if (options.ecoClaims?.length) {
            fixtures.ecoClaims = options.ecoClaims.map((claim) => ({
                claim,
                brandId,
            }));
        }
        if (options.attributes?.length) {
            fixtures.attributes = options.attributes.map((attr) => ({
                name: attr.name,
                brandId,
            }));
        }

        // Insert all fixtures and build ID maps
        const result: InsertedCatalog = {
            materials: new Map(),
            seasons: new Map(),
            tags: new Map(),
            facilities: new Map(),
            attributes: new Map(),
            attributeValues: new Map(),
            manufacturers: new Map(),
            ecoClaims: new Map(),
        };

        // Insert materials
        if (fixtures.materials.length > 0) {
            const inserted = await db
                .insert(schema.brandMaterials)
                .values(fixtures.materials)
                .returning({ id: schema.brandMaterials.id, name: schema.brandMaterials.name });
            for (const row of inserted) {
                result.materials.set(row.name, row.id);
            }
        }

        // Insert seasons
        if (fixtures.seasons.length > 0) {
            const inserted = await db
                .insert(schema.brandSeasons)
                .values(fixtures.seasons)
                .returning({ id: schema.brandSeasons.id, name: schema.brandSeasons.name });
            for (const row of inserted) {
                result.seasons.set(row.name, row.id);
            }
        }

        // Insert tags
        if (fixtures.tags.length > 0) {
            const inserted = await db
                .insert(schema.brandTags)
                .values(fixtures.tags)
                .returning({ id: schema.brandTags.id, name: schema.brandTags.name });
            for (const row of inserted) {
                result.tags.set(row.name, row.id);
            }
        }

        // Insert facilities (uses displayName)
        if (fixtures.facilities.length > 0) {
            const inserted = await db
                .insert(schema.brandFacilities)
                .values(fixtures.facilities)
                .returning({ id: schema.brandFacilities.id, displayName: schema.brandFacilities.displayName });
            for (const row of inserted) {
                result.facilities.set(row.displayName, row.id);
            }
        }

        // Insert manufacturers
        if (fixtures.manufacturers.length > 0) {
            const inserted = await db
                .insert(schema.brandManufacturers)
                .values(fixtures.manufacturers)
                .returning({
                    id: schema.brandManufacturers.id,
                    name: schema.brandManufacturers.name,
                });
            for (const row of inserted) {
                result.manufacturers.set(row.name, row.id);
            }
        }

        // Insert eco claims (uses claim)
        if (fixtures.ecoClaims.length > 0) {
            const inserted = await db
                .insert(schema.brandEcoClaims)
                .values(fixtures.ecoClaims)
                .returning({ id: schema.brandEcoClaims.id, claim: schema.brandEcoClaims.claim });
            for (const row of inserted) {
                result.ecoClaims.set(row.claim, row.id);
            }
        }

        // Insert attributes
        if (fixtures.attributes.length > 0) {
            const inserted = await db
                .insert(schema.brandAttributes)
                .values(fixtures.attributes)
                .returning({ id: schema.brandAttributes.id, name: schema.brandAttributes.name });
            for (const row of inserted) {
                result.attributes.set(row.name, row.id);
            }
        }

        // Build attribute ID map for attribute values
        const attributeIdMap: Record<string, string> = {};
        for (const [name, id] of result.attributes.entries()) {
            attributeIdMap[name] = id;
        }

        // Insert attribute values (from custom options or defaults)
        let attributeValuesToInsert: Array<{
            brandId: string;
            attributeId: string;
            name: string;
        }> = [];

        if (options.attributes?.length) {
            // Use custom attribute values
            for (const attr of options.attributes) {
                const attrId = result.attributes.get(attr.name);
                if (attrId) {
                    for (const valueName of attr.values) {
                        attributeValuesToInsert.push({
                            brandId,
                            attributeId: attrId,
                            name: valueName,
                        });
                    }
                }
            }
        } else if (!empty && !minimal) {
            // Use default attribute values for full catalog
            attributeValuesToInsert = createAttributeValueFixtures(brandId, attributeIdMap);
        }

        if (attributeValuesToInsert.length > 0) {
            const inserted = await db
                .insert(schema.brandAttributeValues)
                .values(attributeValuesToInsert)
                .returning({
                    id: schema.brandAttributeValues.id,
                    attributeId: schema.brandAttributeValues.attributeId,
                    name: schema.brandAttributeValues.name,
                });

            for (const row of inserted) {
                // Find attribute name by ID
                const attrName = Array.from(result.attributes.entries()).find(
                    ([, id]) => id === row.attributeId
                )?.[0];
                if (attrName) {
                    result.attributeValues.set(`${attrName}:${row.name}`, row.id);
                }
            }
        }

        return result;
    }

    /**
     * Cleanup catalog data for a brand.
     * Note: This is typically handled by the global test cleanup,
     * but can be called manually if needed.
     */
    static async cleanup(db: Database, brandId: string): Promise<void> {
        // Cleanup is handled by global TRUNCATE in test setup
        // This method is a no-op but kept for API consistency
        void db;
        void brandId;
    }

    /**
     * Create a minimal catalog with just the essentials for testing
     */
    static async setupMinimal(
        db: Database,
        brandId: string
    ): Promise<InsertedCatalog> {
        return TestCatalog.setup(db, { brandId, minimal: true });
    }

    /**
     * Create an empty catalog for testing auto-creation in ENRICH mode
     */
    static async setupEmpty(
        db: Database,
        brandId: string
    ): Promise<InsertedCatalog> {
        return TestCatalog.setup(db, { brandId, empty: true });
    }

    /**
     * Create a full catalog with all standard fixtures
     */
    static async setupFull(
        db: Database,
        brandId: string
    ): Promise<InsertedCatalog> {
        return TestCatalog.setup(db, { brandId });
    }
}
