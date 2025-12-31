/**
 * Basic Sync Tests - Phase 1
 *
 * Tests basic product sync functionality with various product configurations.
 * Covers Tests 1.1-1.6 from the integration test plan.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { eq } from "drizzle-orm";
import { products, productVariants, productVariantAttributes, brandAttributes, brandAttributeValues, productTags, brandTags } from "@v1/db/schema";
import { syncProducts } from "../../src/sync/engine";
import { testDb, createTestBrand, createTestBrandIntegration, createDefaultFieldConfigs } from "../utils/test-db";
import { createTestSyncContext } from "../utils/sync-context";
import {
    setMockProducts,
    clearMockProducts,
    createMockProduct,
    createMockVariant,
    createSizeVariants,
    createColorSizeVariants,
    createThreeAttributeVariants,
} from "../utils/mock-shopify";

describe("Phase 1: Basic Product Sync", () => {
    let brandId: string;
    let brandIntegrationId: string;

    beforeEach(async () => {
        clearMockProducts();
        brandId = await createTestBrand("Test Brand");
        brandIntegrationId = await createTestBrandIntegration(brandId, "shopify");
        await createDefaultFieldConfigs(brandIntegrationId);
    });

    // =========================================================================
    // Test 1.1: Single Product, No Variants
    // =========================================================================

    it("1.1 - syncs a single product with no variants (just default variant)", async () => {
        // Arrange: Create a product with a single default variant
        const mockProduct = createMockProduct({
            title: "Test Simple Product",
            description: "A simple product with no options",
            variants: [
                createMockVariant({
                    sku: "SIMPLE-001",
                    selectedOptions: [], // No options means single variant
                }),
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);
        expect(result.variantsCreated).toBe(1);

        // Assert: Product created with correct data
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        expect(product).toBeDefined();
        expect(product!.name).toBe("Test Simple Product");
        expect(product!.description).toBe("A simple product with no options");

        // Assert: Single variant with correct SKU
        const variants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, product!.id));

        expect(variants).toHaveLength(1);
        expect(variants[0]!.sku).toBe("SIMPLE-001");

        // Assert: No attributes assigned (no options in Shopify)
        const attributes = await testDb
            .select()
            .from(productVariantAttributes)
            .where(eq(productVariantAttributes.variantId, variants[0]!.id));

        expect(attributes).toHaveLength(0);
    });

    // =========================================================================
    // Test 1.2: Product with One Attribute (Size)
    // =========================================================================

    it("1.2 - syncs a product with one attribute (Size = S, M, L)", async () => {
        // Arrange: Create a product with size variants
        const mockProduct = createMockProduct({
            title: "Test Size Product",
            variants: createSizeVariants("SIZE", ["S", "M", "L"]),
            options: [
                {
                    id: "gid://shopify/ProductOption/1",
                    name: "Size",
                    position: 1,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "1", name: "S", linkedMetafieldValue: null, swatch: null },
                        { id: "2", name: "M", linkedMetafieldValue: null, swatch: null },
                        { id: "3", name: "L", linkedMetafieldValue: null, swatch: null },
                    ],
                },
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded with 3 variants
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);
        expect(result.variantsCreated).toBe(3);

        // Assert: Product created
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        expect(product).toBeDefined();
        expect(product!.name).toBe("Test Size Product");

        // Assert: 3 variants with correct SKUs
        const variants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, product!.id));

        expect(variants).toHaveLength(3);
        const skus = variants.map((v: typeof variants[number]) => v.sku).sort();
        expect(skus).toEqual(["SIZE-L", "SIZE-M", "SIZE-S"]);

        // Assert: Size attribute created in Avelero
        const attrs = await testDb
            .select()
            .from(brandAttributes)
            .where(eq(brandAttributes.brandId, brandId));

        expect(attrs).toHaveLength(1);
        expect(attrs[0]!.name).toBe("Size");

        // Assert: Size values created (S, M, L)
        const values = await testDb
            .select()
            .from(brandAttributeValues)
            .where(eq(brandAttributeValues.attributeId, attrs[0]!.id));

        expect(values).toHaveLength(3);
        const valueNames = values.map((v: typeof values[number]) => v.name).sort();
        expect(valueNames).toEqual(["L", "M", "S"]);
    });

    // =========================================================================
    // Test 1.3: Product with Two Attributes (Color × Size)
    // =========================================================================

    it("1.3 - syncs a product with two attributes (Color × Size = 6 variants)", async () => {
        // Arrange: Red/Blue × S/M/L = 6 variants
        const mockProduct = createMockProduct({
            title: "Test Color Size Product",
            variants: createColorSizeVariants("COLSIZE", ["Red", "Blue"], ["S", "M", "L"]),
            options: [
                {
                    id: "gid://shopify/ProductOption/1",
                    name: "Color",
                    position: 1,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "1", name: "Red", linkedMetafieldValue: null, swatch: null },
                        { id: "2", name: "Blue", linkedMetafieldValue: null, swatch: null },
                    ],
                },
                {
                    id: "gid://shopify/ProductOption/2",
                    name: "Size",
                    position: 2,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "3", name: "S", linkedMetafieldValue: null, swatch: null },
                        { id: "4", name: "M", linkedMetafieldValue: null, swatch: null },
                        { id: "5", name: "L", linkedMetafieldValue: null, swatch: null },
                    ],
                },
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded with 6 variants
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);
        expect(result.variantsCreated).toBe(6);

        // Assert: Product created
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        expect(product).toBeDefined();

        // Assert: 6 variants created
        const variants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, product!.id));

        expect(variants).toHaveLength(6);

        // Assert: Color and Size attributes created
        const attrs = await testDb
            .select()
            .from(brandAttributes)
            .where(eq(brandAttributes.brandId, brandId));

        expect(attrs).toHaveLength(2);
        const attrNames = attrs.map((a: typeof attrs[number]) => a.name).sort();
        expect(attrNames).toEqual(["Color", "Size"]);

        // Assert: Correct attribute values on each variant
        // Each variant should have 2 attribute assignments (Color + Size)
        for (const variant of variants) {
            const variantAttrs = await testDb
                .select()
                .from(productVariantAttributes)
                .where(eq(productVariantAttributes.variantId, variant.id));

            expect(variantAttrs).toHaveLength(2);
        }
    });

    // =========================================================================
    // Test 1.4: Product with Three Attributes (Max)
    // =========================================================================

    it("1.4 - syncs a product with three attributes (Color × Size × Material = 8 variants)", async () => {
        // Arrange: Black/White × S/M × Cotton/Polyester = 8 variants
        const mockProduct = createMockProduct({
            title: "Test Three Attr Product",
            variants: createThreeAttributeVariants(
                "TRIPLE",
                ["Black", "White"],
                ["S", "M"],
                ["Cotton", "Polyester"]
            ),
            options: [
                {
                    id: "gid://shopify/ProductOption/1",
                    name: "Color",
                    position: 1,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "1", name: "Black", linkedMetafieldValue: null, swatch: null },
                        { id: "2", name: "White", linkedMetafieldValue: null, swatch: null },
                    ],
                },
                {
                    id: "gid://shopify/ProductOption/2",
                    name: "Size",
                    position: 2,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "3", name: "S", linkedMetafieldValue: null, swatch: null },
                        { id: "4", name: "M", linkedMetafieldValue: null, swatch: null },
                    ],
                },
                {
                    id: "gid://shopify/ProductOption/3",
                    name: "Material",
                    position: 3,
                    linkedMetafield: null,
                    optionValues: [
                        { id: "5", name: "Cotton", linkedMetafieldValue: null, swatch: null },
                        { id: "6", name: "Polyester", linkedMetafieldValue: null, swatch: null },
                    ],
                },
            ],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded with 8 variants
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);
        expect(result.variantsCreated).toBe(8);

        // Assert: 8 variants created
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        const variants = await testDb
            .select()
            .from(productVariants)
            .where(eq(productVariants.productId, product!.id));

        expect(variants).toHaveLength(8);

        // Assert: 3 attributes created
        const attrs = await testDb
            .select()
            .from(brandAttributes)
            .where(eq(brandAttributes.brandId, brandId));

        expect(attrs).toHaveLength(3);
        const attrNames = attrs.map((a: typeof attrs[number]) => a.name).sort();
        expect(attrNames).toEqual(["Color", "Material", "Size"]);

        // Assert: Each variant has 3 attribute assignments
        for (const variant of variants) {
            const variantAttrs = await testDb
                .select()
                .from(productVariantAttributes)
                .where(eq(productVariantAttributes.variantId, variant.id));

            expect(variantAttrs).toHaveLength(3);
        }
    });

    // =========================================================================
    // Test 1.5: Product with Tags
    // =========================================================================

    it("1.5 - syncs a product with tags", async () => {
        // Arrange: Create product with tags
        const mockProduct = createMockProduct({
            title: "Test Tagged Product",
            tags: ["Summer", "New Arrival", "Sale"],
            variants: [createMockVariant({ sku: "TAGGED-001" })],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);

        // Assert: Product created
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        expect(product).toBeDefined();

        // Assert: Tags created in Avelero
        const tags = await testDb
            .select()
            .from(brandTags)
            .where(eq(brandTags.brandId, brandId));

        expect(tags).toHaveLength(3);
        const tagNames = tags.map((t: typeof tags[number]) => t.name).sort();
        expect(tagNames).toEqual(["New Arrival", "Sale", "Summer"]);

        // Assert: Product associated with tags
        const associations = await testDb
            .select()
            .from(productTags)
            .where(eq(productTags.productId, product!.id));

        expect(associations).toHaveLength(3);
    });

    // =========================================================================
    // Test 1.6: Product with Category
    // =========================================================================

    it("1.6 - syncs a product with category", async () => {
        // Arrange: Create product with Shopify taxonomy category
        const mockProduct = createMockProduct({
            title: "Test Categorized Product",
            category: {
                id: "gid://shopify/TaxonomyCategory/aa-1-1", // Apparel > Shirts > T-shirts
                name: "T-shirts",
                fullName: "Apparel > Shirts > T-shirts",
            },
            variants: [createMockVariant({ sku: "CAT-001" })],
        });
        setMockProducts([mockProduct]);

        const ctx = createTestSyncContext({
            brandId,
            brandIntegrationId,
            productsTotal: 1,
        });

        // Act: Run sync
        const result = await syncProducts(ctx);

        // Assert: Sync succeeded
        expect(result.success).toBe(true);
        expect(result.productsCreated).toBe(1);

        // Assert: Product created
        // Note: Category mapping depends on the taxonomy_external_mappings table being populated
        // In a real test, we'd also verify categoryId is set correctly, but that requires
        // the taxonomy mapping to be seeded. For now, we just verify the sync doesn't fail.
        const [product] = await testDb
            .select()
            .from(products)
            .where(eq(products.brandId, brandId))
            .limit(1);

        expect(product).toBeDefined();
        expect(product!.name).toBe("Test Categorized Product");
    });
});
