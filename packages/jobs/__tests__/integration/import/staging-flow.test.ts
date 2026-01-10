/**
 * Integration Tests: Staging Flow
 *
 * Tests the staging table operations during import.
 * Validates that products and variants are correctly staged
 * before commit to production tables.
 *
 * @module tests/integration/import/staging-flow
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand } from "@v1/testing/db";
import {
    ExcelBuilder,
    basicProduct,
    multiVariantProduct,
    TestCatalog,
    TestDatabase,
    type InsertedCatalog,
} from "@v1/testing/bulk-import";
import * as schema from "@v1/db/schema";
import { eq } from "drizzle-orm";

describe("Staging Flow", () => {
    let brandId: string;
    let catalog: InsertedCatalog;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
        catalog = await TestCatalog.setupFull(testDb, brandId);
    });

    describe("Staging Record Creation", () => {
        it("creates staging records for products", async () => {
            // Create a job
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Manually create a staging product record
            const stagingProductId = crypto.randomUUID();
            const productId = crypto.randomUUID();

            await testDb.insert(schema.stagingProducts).values({
                stagingId: stagingProductId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: productId,
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
            });

            // Verify staging record was created
            const stagingProducts = await TestDatabase.getStagingProducts(
                testDb,
                job.id
            );

            expect(stagingProducts).toHaveLength(1);
            expect(stagingProducts[0]?.productHandle).toBe("test-product");
            expect(stagingProducts[0]?.rowNumber).toBe(4);
            expect(stagingProducts[0]?.rowStatus).toBe("PENDING");
        });

        it("creates staging records for variants", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Create staging product first
            const stagingProductId = crypto.randomUUID();
            const productId = crypto.randomUUID();

            await testDb.insert(schema.stagingProducts).values({
                stagingId: stagingProductId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: productId,
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
            });

            // Create staging variants
            const variantId = crypto.randomUUID();
            await testDb.insert(schema.stagingProductVariants).values({
                stagingId: crypto.randomUUID(),
                stagingProductId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: variantId,
                productId,
                sku: "TEST-SKU-001",
                barcode: "1234567890123",
                rowStatus: "PENDING",
            });

            // Verify staging variants
            const stagingVariants = await TestDatabase.getStagingVariants(
                testDb,
                job.id
            );

            expect(stagingVariants).toHaveLength(1);
            expect(stagingVariants[0]?.sku).toBe("TEST-SKU-001");
            expect(stagingVariants[0]?.barcode).toBe("1234567890123");
        });

        it("tracks row numbers in staging", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Create multiple staging products with different row numbers
            const products = [
                { row: 4, handle: "product-1" },
                { row: 5, handle: "product-2" },
                { row: 6, handle: "product-3" },
            ];

            for (const p of products) {
                await testDb.insert(schema.stagingProducts).values({
                    stagingId: crypto.randomUUID(),
                    jobId: job.id,
                    rowNumber: p.row,
                    action: "CREATE",
                    id: crypto.randomUUID(),
                    brandId,
                    name: `Product ${p.row}`,
                    productHandle: p.handle,
                    rowStatus: "PENDING",
                });
            }

            const stagingProducts = await TestDatabase.getStagingProducts(
                testDb,
                job.id
            );

            expect(stagingProducts).toHaveLength(3);

            // Verify row numbers are preserved
            const rowNumbers = stagingProducts.map((p) => p.rowNumber).sort();
            expect(rowNumbers).toEqual([4, 5, 6]);
        });
    });

    describe("Staging Status Tracking", () => {
        it("marks staging records as PENDING initially", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            await testDb.insert(schema.stagingProducts).values({
                stagingId: crypto.randomUUID(),
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: crypto.randomUUID(),
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
            });

            const stagingProducts = await TestDatabase.getStagingProducts(
                testDb,
                job.id
            );

            expect(stagingProducts[0]?.rowStatus).toBe("PENDING");
        });

        it("marks staging records as COMMITTED after commit", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);
            const stagingId = crypto.randomUUID();

            await testDb.insert(schema.stagingProducts).values({
                stagingId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: crypto.randomUUID(),
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
            });

            // Simulate commit by updating status
            await testDb
                .update(schema.stagingProducts)
                .set({ rowStatus: "COMMITTED" })
                .where(eq(schema.stagingProducts.stagingId, stagingId));

            const stagingProducts = await TestDatabase.getStagingProducts(
                testDb,
                job.id
            );

            expect(stagingProducts[0]?.rowStatus).toBe("COMMITTED");
        });

        it("marks staging records as FAILED on error", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);
            const stagingId = crypto.randomUUID();

            await testDb.insert(schema.stagingProducts).values({
                stagingId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: crypto.randomUUID(),
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
                errors: [
                    { field: "Category", message: "Category not found" },
                ],
            });

            // Simulate failure
            await testDb
                .update(schema.stagingProducts)
                .set({ rowStatus: "FAILED" })
                .where(eq(schema.stagingProducts.stagingId, stagingId));

            const stagingProducts = await TestDatabase.getStagingProducts(
                testDb,
                job.id
            );

            expect(stagingProducts[0]?.rowStatus).toBe("FAILED");
        });
    });

    describe("Staging Counts", () => {
        it("counts staged products for a job", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Create multiple staging products
            for (let i = 0; i < 5; i++) {
                await testDb.insert(schema.stagingProducts).values({
                    stagingId: crypto.randomUUID(),
                    jobId: job.id,
                    rowNumber: 4 + i,
                    action: "CREATE",
                    id: crypto.randomUUID(),
                    brandId,
                    name: `Product ${i}`,
                    productHandle: `product-${i}`,
                    rowStatus: "PENDING",
                });
            }

            const count = await TestDatabase.getStagingProductCount(
                testDb,
                job.id
            );

            expect(count).toBe(5);
        });

        it("counts staged variants for a job", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Create a staging product
            const stagingProductId = crypto.randomUUID();
            const productId = crypto.randomUUID();

            await testDb.insert(schema.stagingProducts).values({
                stagingId: stagingProductId,
                jobId: job.id,
                rowNumber: 4,
                action: "CREATE",
                id: productId,
                brandId,
                name: "Test Product",
                productHandle: "test-product",
                rowStatus: "PENDING",
            });

            // Create multiple staging variants
            for (let i = 0; i < 3; i++) {
                await testDb.insert(schema.stagingProductVariants).values({
                    stagingId: crypto.randomUUID(),
                    stagingProductId,
                    jobId: job.id,
                    rowNumber: 4 + i,
                    action: "CREATE",
                    id: crypto.randomUUID(),
                    productId,
                    sku: `SKU-${i}`,
                    rowStatus: "PENDING",
                });
            }

            const count = await TestDatabase.getStagingVariantCount(
                testDb,
                job.id
            );

            expect(count).toBe(3);
        });
    });

    describe("Multi-Job Isolation", () => {
        it("isolates staging records between jobs", async () => {
            // Create two jobs
            const job1 = await TestDatabase.createImportJob(testDb, brandId, {
                filename: "import-1.xlsx",
            });
            const job2 = await TestDatabase.createImportJob(testDb, brandId, {
                filename: "import-2.xlsx",
            });

            // Add products to job 1
            for (let i = 0; i < 3; i++) {
                await testDb.insert(schema.stagingProducts).values({
                    stagingId: crypto.randomUUID(),
                    jobId: job1.id,
                    rowNumber: 4 + i,
                    action: "CREATE",
                    id: crypto.randomUUID(),
                    brandId,
                    name: `Job1 Product ${i}`,
                    productHandle: `job1-product-${i}`,
                    rowStatus: "PENDING",
                });
            }

            // Add products to job 2
            for (let i = 0; i < 2; i++) {
                await testDb.insert(schema.stagingProducts).values({
                    stagingId: crypto.randomUUID(),
                    jobId: job2.id,
                    rowNumber: 4 + i,
                    action: "CREATE",
                    id: crypto.randomUUID(),
                    brandId,
                    name: `Job2 Product ${i}`,
                    productHandle: `job2-product-${i}`,
                    rowStatus: "PENDING",
                });
            }

            // Verify counts are isolated
            const job1Count = await TestDatabase.getStagingProductCount(
                testDb,
                job1.id
            );
            const job2Count = await TestDatabase.getStagingProductCount(
                testDb,
                job2.id
            );

            expect(job1Count).toBe(3);
            expect(job2Count).toBe(2);
        });
    });
});
