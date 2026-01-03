/**
 * Secondary Integration Tests
 *
 * Tests for secondary integration sync behavior.
 * Secondary integrations can only enrich existing products/variants via
 * barcode/SKU match. They cannot create products, variants, or attributes.
 *
 * Covers tests from Section 4.2 of integration-refactor-plan.md:
 * - S-SYNC-001: Secondary cannot create products
 * - S-SYNC-002: Secondary enriches by barcode match
 * - S-SYNC-003: Secondary enriches by SKU match
 * - S-SYNC-004: Secondary skips unmatched variants
 * - S-STRUCT-001: Secondary cannot create attributes
 * - S-STRUCT-002: Secondary cannot create variants
 * - S-STRUCT-003: Secondary cannot modify attribute assignments
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import {
    products,
    productVariants,
    productVariantAttributes,
    brandAttributes,
    brandAttributeValues,
    integrationProductLinks,
    integrationVariantLinks,
    productCommercial,
} from "@v1/db/schema";
import { syncProducts } from "../../../src/sync/engine";
import {
    testDb,
    createTestBrand,
    createTestBrandIntegration,
    createDefaultFieldConfigs,
} from "@v1/testing/db";
import { createTestSyncContext } from "@v1/testing/context";
import {
    setMockProducts,
    clearMockProducts,
    createMockProduct,
    createMockVariant,
} from "@v1/testing/mocks/shopify";

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

let idCounter = Date.now();
function nextProductId(): string {
    return `gid://shopify/Product/${idCounter++}`;
}
function nextVariantId(): string {
    return `gid://shopify/ProductVariant/${idCounter++}`;
}

function generateUpid(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 16 }, () =>
        chars[Math.floor(Math.random() * chars.length)]
    ).join("");
}

/**
 * Create an existing Avelero product with variants for secondary sync tests.
 */
async function createExistingProduct(options: {
    brandId: string;
    name: string;
    variants: Array<{ sku: string | null; barcode: string | null }>;
    withAttributes?: { name: string; values: string[] };
}): Promise<{
    product: typeof products.$inferSelect;
    variants: (typeof productVariants.$inferSelect)[];
}> {
    const handle = options.name.toLowerCase().replace(/\\s+/g, "-");

    const [product] = await testDb
        .insert(products)
        .values({
            brandId: options.brandId,
            name: options.name,
            productHandle: handle,
            source: "integration",
        })
        .returning();

    const variantData = options.variants.map((v) => ({
        productId: product!.id,
        sku: v.sku,
        barcode: v.barcode,
        upid: generateUpid(),
    }));

    const variants = await testDb
        .insert(productVariants)
        .values(variantData)
        .returning();

    // Create attribute and assign to variants if requested
    if (options.withAttributes) {
        const [attr] = await testDb
            .insert(brandAttributes)
            .values({
                brandId: options.brandId,
                name: options.withAttributes.name,
            })
            .returning();

        const values = await testDb
            .insert(brandAttributeValues)
            .values(
                options.withAttributes.values.map((val, i) => ({
                    brandId: options.brandId,
                    attributeId: attr!.id,
                    name: val,
                }))
            )
            .returning();

        // Assign first value to first variant, second to second, etc.
        for (let i = 0; i < variants.length && i < values.length; i++) {
            await testDb.insert(productVariantAttributes).values({
                variantId: variants[i]!.id,
                attributeValueId: values[i]!.id,
                sortOrder: 0,
            });
        }
    }

    return { product: product!, variants };
}

// =============================================================================
// S-SYNC-001: Secondary Cannot Create Products
// =============================================================================

describe("S-SYNC-001: Secondary Cannot Create Products", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");

        // Create primary integration (required)
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);

        // Create secondary integration (using a different integration type)
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary sync with unmatched product creates nothing", async () => {
        // Arrange: NO existing products in Avelero
        // Secondary has a product that won't match anything
        const mockProduct = createMockProduct({
            title: "Unmatched Product",
            variants: [
                createMockVariant({
                    sku: "NOMATCH-001",
                    barcode: "NOMATCH-BARCODE",
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false, // Explicitly secondary
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: No products/variants created
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);
        expect(result.productsSkippedNoMatch).toBe(1);

        // Verify database is empty
        const allProducts = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId));
        expect(allProducts).toHaveLength(0);
    });
});

// =============================================================================
// S-SYNC-002: Secondary Enriches by Barcode Match
// =============================================================================

describe("S-SYNC-002: Secondary Enriches by Barcode Match", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("enriches existing product by matching variant barcode", async () => {
        // Arrange: Create existing product with barcode
        const existingBarcode = "ENRICH-BARCODE-001";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Existing Product",
            variants: [{ sku: "EXIST-SKU", barcode: existingBarcode }],
        });

        // Secondary has product with matching barcode
        const mockProduct = createMockProduct({
            title: "Secondary Product",
            description: "Enriched description from secondary",
            variants: [
                createMockVariant({
                    sku: "SECONDARY-SKU",
                    barcode: existingBarcode, // Matches existing
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);

        // Verify link was created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
    });
});

// =============================================================================
// S-SYNC-003: Secondary Enriches by SKU Match
// =============================================================================

describe("S-SYNC-003: Secondary Enriches by SKU Match", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("enriches existing product by matching variant SKU", async () => {
        // Arrange: Create existing product with SKU
        const existingSku = "ENRICH-SKU-001";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Existing SKU Product",
            variants: [{ sku: existingSku, barcode: "DIFFERENT-BARCODE" }],
        });

        // Secondary has product with matching SKU (different barcode)
        const mockProduct = createMockProduct({
            title: "Secondary SKU Product",
            variants: [
                createMockVariant({
                    sku: existingSku, // Matches existing
                    barcode: "SECONDARY-BARCODE", // Different barcode
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "sku",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsCreated).toBe(0);

        // Verify link was created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
    });
});

// =============================================================================
// S-SYNC-004: Secondary Skips Unmatched Variants
// =============================================================================

describe("S-SYNC-004: Secondary Skips Unmatched Variants", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("skips variants that have no barcode/SKU match", async () => {
        // Arrange: Create existing product with 2 variants
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Partial Match Product",
            variants: [
                { sku: "MATCH-001", barcode: "MATCH-BARCODE-1" },
                { sku: "MATCH-002", barcode: "MATCH-BARCODE-2" },
            ],
        });

        // Secondary has 4 variants: 2 match, 2 don't
        const mockProduct = createMockProduct({
            title: "Secondary Product",
            variants: [
                createMockVariant({ sku: "MATCH-001", barcode: "MATCH-BARCODE-1" }), // Match
                createMockVariant({ sku: "MATCH-002", barcode: "MATCH-BARCODE-2" }), // Match
                createMockVariant({ sku: "NOMATCH-003", barcode: "NOMATCH-3" }), // No match
                createMockVariant({ sku: "NOMATCH-004", barcode: "NOMATCH-4" }), // No match
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.variantsCreated).toBe(0); // No new variants (secondary can't create)
        expect(result.variantsSkippedNoMatch).toBe(2); // 2 variants couldn't match

        // Verify only 2 links created (for matching variants)
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(2);
    });
});

// =============================================================================
// S-STRUCT-001: Secondary Cannot Create Attributes
// =============================================================================

describe("S-STRUCT-001: Secondary Cannot Create Attributes", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary sync does not create new attributes from options", async () => {
        // Arrange: Create existing product with Size attribute
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Attribute Test Product",
            variants: [{ sku: "ATTR-001", barcode: "ATTR-BARCODE-1" }],
            withAttributes: { name: "Size", values: ["S", "M"] },
        });

        // Secondary has same barcode but with additional "Material" attribute
        const mockProduct = createMockProduct({
            title: "Secondary with new attribute",
            variants: [
                createMockVariant({
                    sku: "ATTR-001",
                    barcode: "ATTR-BARCODE-1",
                    selectedOptions: [
                        { name: "Size", value: "S" },
                        { name: "Material", value: "Cotton" }, // New attribute
                    ],
                }),
            ],
            options: [
                {
                    id: "gid://shopify/ProductOption/1",
                    name: "Size",
                    position: 1,
                    linkedMetafield: null,
                    optionValues: [{ id: "1", name: "S", linkedMetafieldValue: null, swatch: null }],
                },
                {
                    id: "gid://shopify/ProductOption/2",
                    name: "Material",
                    position: 2,
                    linkedMetafield: null,
                    optionValues: [{ id: "2", name: "Cotton", linkedMetafieldValue: null, swatch: null }],
                },
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Verify no new attribute was created - only Size should exist
        const allAttrs = await testDb
            .select()
            .from(brandAttributes)
            .where(eq(brandAttributes.brandId, brandId));

        expect(allAttrs).toHaveLength(1);
        expect(allAttrs[0]!.name).toBe("Size");
    });
});

// =============================================================================
// S-STRUCT-002: Secondary Cannot Create Variants
// =============================================================================

describe("S-STRUCT-002: Secondary Cannot Create Variants", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary sync does not create new variants for unmatched barcodes", async () => {
        // Arrange: Create existing product with 1 variant
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Variant Creation Test",
            variants: [{ sku: "EXIST-001", barcode: "EXIST-BARCODE-1" }],
        });

        // Secondary has 2 variants: 1 matches, 1 doesn't
        const mockProduct = createMockProduct({
            title: "Secondary with new variant",
            variants: [
                createMockVariant({ sku: "EXIST-001", barcode: "EXIST-BARCODE-1" }), // Match
                createMockVariant({ sku: "NEW-002", barcode: "NEW-BARCODE-2" }), // No match
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);
        expect(result.variantsCreated).toBe(0); // No new variants created

        // Verify still only 1 variant exists
        const allVariants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, product.id));
        expect(allVariants).toHaveLength(1);
    });
});

// =============================================================================
// S-STRUCT-003: Secondary Cannot Modify Attribute Assignments
// =============================================================================

describe("S-STRUCT-003: Secondary Cannot Modify Attribute Assignments", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary sync does not change existing attribute assignments", async () => {
        // Arrange: Create existing product with Color = "Black" assignment
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Attribute Assignment Test",
            variants: [{ sku: "ASSIGN-001", barcode: "ASSIGN-BARCODE-1" }],
            withAttributes: { name: "Color", values: ["Black"] },
        });

        // Get the initial assignment
        const initialAssignments = await testDb
            .select()
            .from(productVariantAttributes)
            .where(eq(productVariantAttributes.variantId, variants[0]!.id));
        expect(initialAssignments).toHaveLength(1);
        const originalValueId = initialAssignments[0]!.attributeValueId;

        // Secondary claims the same variant has Color = "White"
        const mockProduct = createMockProduct({
            title: "Secondary different color",
            variants: [
                createMockVariant({
                    sku: "ASSIGN-001",
                    barcode: "ASSIGN-BARCODE-1",
                    selectedOptions: [{ name: "Color", value: "White" }], // Different
                }),
            ],
            options: [
                {
                    id: "gid://shopify/ProductOption/1",
                    name: "Color",
                    position: 1,
                    linkedMetafield: null,
                    optionValues: [{ id: "1", name: "White", linkedMetafieldValue: null, swatch: null }],
                },
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert
        expect(result.success).toBe(true);

        // Verify attribute assignment is unchanged (still Black, not White)
        const finalAssignments = await testDb
            .select()
            .from(productVariantAttributes)
            .where(eq(productVariantAttributes.variantId, variants[0]!.id));

        expect(finalAssignments).toHaveLength(1);
        expect(finalAssignments[0]!.attributeValueId).toBe(originalValueId);

        // Verify no "White" value was created
        const [colorAttr] = await testDb
            .select()
            .from(brandAttributes)
            .where(eq(brandAttributes.brandId, brandId))
            .limit(1);

        const colorValues = await testDb
            .select()
            .from(brandAttributeValues)
            .where(eq(brandAttributeValues.attributeId, colorAttr!.id));

        expect(colorValues).toHaveLength(1);
        expect(colorValues[0]!.name).toBe("Black");
    });
});

// =============================================================================
// S-MATCH-001: matchIdentifier Enforcement - Barcode Mode Ignores SKU
// =============================================================================

describe("S-MATCH-001: matchIdentifier Enforcement - Barcode Mode Ignores SKU", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary configured for barcode ignores matching SKU (no barcode match)", async () => {
        // Arrange: Create existing product with specific SKU and no barcode
        const existingSku = "MATCH-SKU-001";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Product with SKU Only",
            variants: [{ sku: existingSku, barcode: "DIFFERENT-BARCODE" }],
        });

        // Secondary has product with matching SKU but DIFFERENT barcode
        const mockProduct = createMockProduct({
            title: "Secondary with SKU Match",
            variants: [
                createMockVariant({
                    sku: existingSku, // Matches existing SKU!
                    barcode: "NOMATCH-BARCODE", // Does NOT match existing barcode
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "barcode", // Configured for barcode matching
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: SKU match is IGNORED because matchIdentifier is "barcode"
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // Cannot create (secondary)
        expect(result.variantsSkippedNoMatch).toBe(1); // Skipped because barcode doesn't match

        // No variant link created despite matching SKU
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(0);
    });

    it("secondary configured for barcode matches by barcode (ignoring SKU mismatch)", async () => {
        // Arrange: Create existing product
        const existingBarcode = "MATCH-BARCODE-001";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Product with Barcode",
            variants: [{ sku: "ORIGINAL-SKU", barcode: existingBarcode }],
        });

        // Secondary has matching barcode but DIFFERENT SKU
        const mockProduct = createMockProduct({
            title: "Secondary Barcode Match",
            variants: [
                createMockVariant({
                    sku: "COMPLETELY-DIFFERENT-SKU", // Different SKU
                    barcode: existingBarcode, // Matches!
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Matches by barcode (SKU mismatch is irrelevant)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsSkippedNoMatch).toBe(0);

        // Variant link created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
    });
});

// =============================================================================
// S-MATCH-002: matchIdentifier Enforcement - SKU Mode Ignores Barcode
// =============================================================================

describe("S-MATCH-002: matchIdentifier Enforcement - SKU Mode Ignores Barcode", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("secondary configured for SKU ignores matching barcode (no SKU match)", async () => {
        // Arrange: Create existing product
        const existingBarcode = "MATCH-BARCODE-002";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Product with Barcode Only Match",
            variants: [{ sku: "DIFFERENT-SKU", barcode: existingBarcode }],
        });

        // Secondary has product with matching BARCODE but different SKU
        const mockProduct = createMockProduct({
            title: "Secondary with Barcode Match",
            variants: [
                createMockVariant({
                    sku: "NOMATCH-SKU", // Does NOT match existing SKU
                    barcode: existingBarcode, // Matches existing barcode!
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "sku", // Configured for SKU matching
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Barcode match is IGNORED because matchIdentifier is "sku"
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0); // Cannot create (secondary)
        expect(result.variantsSkippedNoMatch).toBe(1); // Skipped because SKU doesn't match

        // No variant link created despite matching barcode
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(0);
    });

    it("secondary configured for SKU matches by SKU (ignoring barcode mismatch)", async () => {
        // Arrange: Create existing product
        const existingSku = "MATCH-SKU-002";
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Product with SKU",
            variants: [{ sku: existingSku, barcode: "ORIGINAL-BARCODE" }],
        });

        // Secondary has matching SKU but DIFFERENT barcode
        const mockProduct = createMockProduct({
            title: "Secondary SKU Match",
            variants: [
                createMockVariant({
                    sku: existingSku, // Matches!
                    barcode: "COMPLETELY-DIFFERENT-BARCODE", // Different barcode
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "sku",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: Matches by SKU (barcode mismatch is irrelevant)
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsSkippedNoMatch).toBe(0);

        // Variant link created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(1);
        expect(variantLinks[0]!.variantId).toBe(variants[0]!.id);
    });
});

// =============================================================================
// S-MATCH-003: Case Sensitivity for matchIdentifier
// =============================================================================

describe("S-MATCH-003: Case Sensitivity for matchIdentifier", () => {
    let brandId: string;
    let primaryIntegrationId: string;
    let secondaryIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        primaryIntegrationId = await createTestBrandIntegration(brandId, "shopify", {
            isPrimary: true,
        });
        await createDefaultFieldConfigs(primaryIntegrationId);
        secondaryIntegrationId = await createTestBrandIntegration(brandId, "its-perfect", {
            isPrimary: false,
        });
        await createDefaultFieldConfigs(secondaryIntegrationId);
    });

    it("SKU matching is case-sensitive (different case = no match)", async () => {
        // Arrange: Create existing product with lowercase SKU
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Case Sensitive SKU Product",
            variants: [{ sku: "test-sku-lowercase", barcode: null }],
        });

        // Secondary has UPPERCASE SKU (different case)
        const mockProduct = createMockProduct({
            title: "Secondary Uppercase SKU",
            variants: [
                createMockVariant({
                    sku: "TEST-SKU-LOWERCASE", // UPPERCASE version
                    barcode: null,
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "sku",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: No match due to case difference
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsSkippedNoMatch).toBe(1);

        // No link created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(0);
    });

    it("barcode matching is case-sensitive (different case = no match)", async () => {
        // Arrange: Create existing product with mixed-case barcode
        const { product, variants } = await createExistingProduct({
            brandId,
            name: "Case Sensitive Barcode Product",
            variants: [{ sku: null, barcode: "MixedCaseBarcode123" }],
        });

        // Secondary has all-lowercase barcode (different case)
        const mockProduct = createMockProduct({
            title: "Secondary Lowercase Barcode",
            variants: [
                createMockVariant({
                    sku: null,
                    barcode: "mixedcasebarcode123", // lowercase version
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId: secondaryIntegrationId,
            productsTotal: 1,
            isPrimary: false,
            matchIdentifier: "barcode",
        });

        // Act
        const result = await syncProducts(ctx);

        // Assert: No match due to case difference
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(0);
        expect(result.variantsSkippedNoMatch).toBe(1);

        // No link created
        const variantLinks = await testDb
            .select()
            .from(integrationVariantLinks)
            .where(eq(integrationVariantLinks.brandIntegrationId, secondaryIntegrationId));
        expect(variantLinks).toHaveLength(0);
    });
});
