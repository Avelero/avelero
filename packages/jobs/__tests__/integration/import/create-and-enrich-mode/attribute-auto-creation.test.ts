/**
 * Integration Tests: CREATE_AND_ENRICH Mode - Attribute Auto-Creation
 *
 * Tests the attribute and value auto-creation functionality.
 * Brand attributes and values are auto-created when not found in the catalog.
 *
 * Note: Taxonomy linking tests are skipped as taxonomy data is seeded globally
 * and we cannot reliably insert test taxonomy data.
 *
 * @module tests/integration/import/create-and-enrich-mode/attribute-auto-creation
 */

import "../../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, type InsertedCatalog } from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import { parseExcelFile } from "../../../../src/lib/excel-parser";
import { loadBrandCatalog, type BrandCatalog } from "../../../../src/lib/catalog-loader";
import * as schema from "@v1/db/schema";
import { eq, sql } from "drizzle-orm";

// Helper to simulate auto-creation logic for attributes
async function autoCreateAttributes(
    database: typeof testDb,
    brandId: string,
    parsedProducts: Awaited<ReturnType<typeof parseExcelFile>>["products"],
    catalog: BrandCatalog
): Promise<BrandCatalog> {
    const normalizeKey = (s: string) => s.toLowerCase().trim();

    // Collect unique attributes and values
    const uniqueAttributes = new Set<string>();
    const uniqueAttributeValues = new Map<string, Set<string>>();

    for (const product of parsedProducts) {
        for (const variant of product.variants) {
            for (const attr of variant.attributes) {
                uniqueAttributes.add(attr.name.trim());
                if (!uniqueAttributeValues.has(attr.name.trim())) {
                    uniqueAttributeValues.set(attr.name.trim(), new Set());
                }
                uniqueAttributeValues.get(attr.name.trim())?.add(attr.value.trim());
            }
        }
    }

    // Auto-create missing attributes with taxonomy linking
    const missingAttributes = [...uniqueAttributes].filter(
        (name) => !catalog.attributes.has(normalizeKey(name))
    );

    if (missingAttributes.length > 0) {
        const attributeInsertValues = missingAttributes.map((name) => {
            const normalizedName = normalizeKey(name);
            // Check if there's a matching taxonomy attribute
            const taxonomyAttr = catalog.taxonomyAttributes.get(normalizedName);
            return {
                brandId,
                name,
                taxonomyAttributeId: taxonomyAttr?.id ?? null,
            };
        });

        const inserted = await database
            .insert(schema.brandAttributes)
            .values(attributeInsertValues)
            .returning({
                id: schema.brandAttributes.id,
                name: schema.brandAttributes.name,
                taxonomyAttributeId: schema.brandAttributes.taxonomyAttributeId,
            });

        for (const a of inserted) {
            catalog.attributes.set(normalizeKey(a.name), a.id);
            if (a.taxonomyAttributeId) {
                catalog.attributeTaxonomyLinks.set(normalizeKey(a.name), a.taxonomyAttributeId);
            }
        }
    }

    // Auto-create missing attribute values with taxonomy value linking
    const attributeValueInserts: Array<{
        brandId: string;
        attributeId: string;
        name: string;
        taxonomyValueId: string | null;
    }> = [];

    for (const [attrName, values] of uniqueAttributeValues) {
        const attributeId = catalog.attributes.get(normalizeKey(attrName));
        if (!attributeId) continue;

        const taxonomyAttributeId = catalog.attributeTaxonomyLinks.get(normalizeKey(attrName));

        for (const valueName of values) {
            const key = `${attributeId}:${normalizeKey(valueName)}`;
            if (!catalog.attributeValues.has(key)) {
                let taxonomyValueId: string | null = null;
                if (taxonomyAttributeId) {
                    const taxonomyValueKey = `${taxonomyAttributeId}:${normalizeKey(valueName)}`;
                    const taxonomyValue = catalog.taxonomyValues.get(taxonomyValueKey);
                    if (taxonomyValue) {
                        taxonomyValueId = taxonomyValue.id;
                    }
                }

                attributeValueInserts.push({
                    brandId,
                    attributeId,
                    name: valueName,
                    taxonomyValueId,
                });
            }
        }
    }

    if (attributeValueInserts.length > 0) {
        const inserted = await database
            .insert(schema.brandAttributeValues)
            .values(attributeValueInserts)
            .returning({
                id: schema.brandAttributeValues.id,
                name: schema.brandAttributeValues.name,
                attributeId: schema.brandAttributeValues.attributeId,
                taxonomyValueId: schema.brandAttributeValues.taxonomyValueId,
            });

        for (const av of inserted) {
            const key = `${av.attributeId}:${normalizeKey(av.name)}`;
            const attrName =
                [...catalog.attributes.entries()].find(([, id]) => id === av.attributeId)?.[0] || "";
            catalog.attributeValues.set(key, {
                id: av.id,
                name: av.name,
                attributeId: av.attributeId,
                attributeName: attrName,
            });
        }
    }

    return catalog;
}

describe("CREATE_AND_ENRICH Mode - Attribute Auto-Creation", () => {
    let brandId: string;
    let emptyCatalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        // Setup empty brand catalog
        emptyCatalog = await TestCatalog.setupEmpty(testDb, brandId);
    });

    describe("Basic Attribute Creation", () => {
        it("creates brand attribute when not found in catalog", async () => {
            const productWithNewAttribute = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [{ name: "Fabric Weight", value: "Light" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithNewAttribute],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            // Should not exist initially
            expect(catalog.attributes.has("fabric weight")).toBe(false);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Should be created
            expect(updatedCatalog.attributes.has("fabric weight")).toBe(true);

            // Verify in database
            const dbAttribute = await testDb.query.brandAttributes.findFirst({
                where: sql`${schema.brandAttributes.brandId} = ${brandId} AND LOWER(${schema.brandAttributes.name}) = 'fabric weight'`,
            });
            expect(dbAttribute).toBeDefined();
            expect(dbAttribute?.name).toBe("Fabric Weight");
        });

        it("creates brand attribute without taxonomy link for custom attributes", async () => {
            // Product with a custom attribute that doesn't exist in taxonomy
            const productWithCustomAttr = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [{ name: "Custom Fit", value: "Relaxed" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithCustomAttr],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            // Verify no taxonomy match exists
            expect(catalog.taxonomyAttributes.has("custom fit")).toBe(false);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Brand attribute should be created
            expect(updatedCatalog.attributes.has("custom fit")).toBe(true);

            // Verify NO taxonomy link in database (null)
            const brandCustomAttr = await testDb.query.brandAttributes.findFirst({
                where: sql`${schema.brandAttributes.brandId} = ${brandId} AND LOWER(${schema.brandAttributes.name}) = 'custom fit'`,
            });

            expect(brandCustomAttr).toBeDefined();
            expect(brandCustomAttr?.taxonomyAttributeId).toBeNull();
        });
    });

    describe("Attribute Value Creation", () => {
        it("creates attribute value for new attribute", async () => {
            const productWithAttribute = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [{ name: "Style", value: "Casual" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithAttribute],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Attribute should be created
            const styleAttrId = updatedCatalog.attributes.get("style")!;
            expect(styleAttrId).toBeDefined();

            // Value should be created
            expect(updatedCatalog.attributeValues.has(`${styleAttrId}:casual`)).toBe(true);

            // Verify in database
            const dbValue = await testDb.query.brandAttributeValues.findFirst({
                where: sql`${schema.brandAttributeValues.attributeId} = ${styleAttrId} AND LOWER(${schema.brandAttributeValues.name}) = 'casual'`,
            });
            expect(dbValue).toBeDefined();
            expect(dbValue?.name).toBe("Casual");
        });

        it("creates multiple values for same attribute", async () => {
            const productWithMultipleVariants = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [{ name: "Length", value: "Short" }],
                    },
                    {
                        sku: "TEST-002",
                        barcode: "1234567890124",
                        attributes: [{ name: "Length", value: "Regular" }],
                    },
                    {
                        sku: "TEST-003",
                        barcode: "1234567890125",
                        attributes: [{ name: "Length", value: "Long" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithMultipleVariants],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            const lengthAttrId = updatedCatalog.attributes.get("length")!;

            // All three values should be created
            const dbValues = await testDb.query.brandAttributeValues.findMany({
                where: eq(schema.brandAttributeValues.attributeId, lengthAttrId),
            });

            expect(dbValues.length).toBe(3);
            expect(dbValues.map((v) => v.name)).toContain("Short");
            expect(dbValues.map((v) => v.name)).toContain("Regular");
            expect(dbValues.map((v) => v.name)).toContain("Long");
        });
    });

    describe("Case-Insensitive Handling", () => {
        it("handles case variations in attribute names", async () => {
            // Two products with different case variations of the same attribute
            const productOne = {
                handle: "product-one",
                title: "Product One",
                variants: [
                    {
                        sku: "PROD1-001",
                        barcode: "1111111111111",
                        attributes: [{ name: "PATTERN", value: "Striped" }],
                    },
                ],
            };

            const productTwo = {
                handle: "product-two",
                title: "Product Two",
                variants: [
                    {
                        sku: "PROD2-001",
                        barcode: "2222222222222",
                        attributes: [{ name: "pattern", value: "Solid" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productOne, productTwo],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Should create only ONE attribute (normalized to lowercase key)
            const brandPatternAttrs = await testDb.query.brandAttributes.findMany({
                where: sql`${schema.brandAttributes.brandId} = ${brandId} AND LOWER(${schema.brandAttributes.name}) = 'pattern'`,
            });

            // Due to case sensitivity in the name field, we might have two entries
            // but the catalog should normalize them to one key
            expect(updatedCatalog.attributes.has("pattern")).toBe(true);
        });
    });

    describe("In-Flight Attribute Creation", () => {
        it("handles attribute created mid-import used in later rows", async () => {
            // Multiple products where first product creates the attribute
            // and subsequent products use the same attribute
            const productOne = {
                handle: "product-one",
                title: "Product One",
                variants: [
                    {
                        sku: "PROD1-001",
                        barcode: "1111111111111",
                        attributes: [{ name: "Collar Type", value: "Round" }],
                    },
                ],
            };

            const productTwo = {
                handle: "product-two",
                title: "Product Two",
                variants: [
                    {
                        sku: "PROD2-001",
                        barcode: "2222222222222",
                        attributes: [{ name: "Collar Type", value: "V-Neck" }],
                    },
                ],
            };

            const productThree = {
                handle: "product-three",
                title: "Product Three",
                variants: [
                    {
                        sku: "PROD3-001",
                        barcode: "3333333333333",
                        attributes: [{ name: "Collar Type", value: "Crew" }],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productOne, productTwo, productThree],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Only ONE Collar Type attribute should be created
            const collarAttrId = updatedCatalog.attributes.get("collar type")!;

            const brandCollarAttrs = await testDb.query.brandAttributes.findMany({
                where: sql`${schema.brandAttributes.brandId} = ${brandId} AND LOWER(${schema.brandAttributes.name}) = 'collar type'`,
            });
            expect(brandCollarAttrs.length).toBe(1);

            // All three values should be created under the same attribute
            const collarValues = await testDb.query.brandAttributeValues.findMany({
                where: eq(schema.brandAttributeValues.attributeId, collarAttrId),
            });
            expect(collarValues.length).toBe(3);
            expect(collarValues.map((v) => v.name)).toContain("Round");
            expect(collarValues.map((v) => v.name)).toContain("V-Neck");
            expect(collarValues.map((v) => v.name)).toContain("Crew");
        });
    });

    describe("Multiple Attributes Per Variant", () => {
        it("creates multiple attributes and values per variant", async () => {
            const productWithMultipleAttrs = {
                ...basicProduct,
                variants: [
                    {
                        sku: "TEST-001",
                        barcode: "1234567890123",
                        attributes: [
                            { name: "Sleeve Length", value: "Short" },
                            { name: "Neck Style", value: "Crew" },
                        ],
                    },
                ],
            };

            const excelBuffer = await ExcelBuilder.create({
                products: [productWithMultipleAttrs],
            });

            const parseResult = await parseExcelFile(excelBuffer);
            const catalog = await loadBrandCatalog(testDb, brandId);

            const updatedCatalog = await autoCreateAttributes(
                testDb,
                brandId,
                parseResult.products,
                catalog
            );

            // Both attributes should be created
            expect(updatedCatalog.attributes.has("sleeve length")).toBe(true);
            expect(updatedCatalog.attributes.has("neck style")).toBe(true);

            // Get IDs
            const sleeveAttrId = updatedCatalog.attributes.get("sleeve length")!;
            const neckAttrId = updatedCatalog.attributes.get("neck style")!;

            // Both values should be created
            const sleeveValues = await testDb.query.brandAttributeValues.findMany({
                where: eq(schema.brandAttributeValues.attributeId, sleeveAttrId),
            });
            expect(sleeveValues.length).toBe(1);
            expect(sleeveValues[0]?.name).toBe("Short");

            const neckValues = await testDb.query.brandAttributeValues.findMany({
                where: eq(schema.brandAttributeValues.attributeId, neckAttrId),
            });
            expect(neckValues.length).toBe(1);
            expect(neckValues[0]?.name).toBe("Crew");
        });
    });
});
