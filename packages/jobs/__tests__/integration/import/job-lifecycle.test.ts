/**
 * Integration Tests: Import Job Lifecycle
 *
 * Tests the complete import job state machine transitions
 * and status updates throughout the import process.
 *
 * @module tests/integration/import/job-lifecycle
 */

import "../../setup";

import { describe, it, expect, beforeEach } from "bun:test";
import { testDb, cleanupTables, createTestBrand, TestCatalog, TestDatabase } from "@v1/db/testing";
import { ExcelBuilder, basicProduct } from "@v1/testing/bulk-import";
import * as schema from "@v1/db/schema";
import { eq } from "drizzle-orm";
import { parseExcelFile } from "../../../src/lib/excel-parser";
import { loadBrandCatalog } from "../../../src/lib/catalog-loader";

describe("Import Job Lifecycle", () => {
    let brandId: string;

    beforeEach(async () => {
        await cleanupTables();
        brandId = await createTestBrand("Test Brand");
    });

    describe("Job Creation and Status Transitions", () => {
        it("creates job in PENDING status", async () => {
            // Create an import job
            const job = await TestDatabase.createImportJob(testDb, brandId, {
                filename: "test-import.xlsx",
            });

            expect(job.id).toBeDefined();
            expect(job.status).toBe("PENDING");
            expect(job.brandId).toBe(brandId);
            expect(job.filename).toBe("test-import.xlsx");
            expect(job.mode).toBe("CREATE");
            expect(job.finishedAt).toBeNull();
        });

        it("transitions to PROCESSING status", async () => {
            // Create a pending job
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Update to PROCESSING (simulating job start)
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "PROCESSING",
                    startedAt: new Date().toISOString(),
                })
                .where(eq(schema.importJobs.id, job.id));

            // Verify the update
            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            expect(updatedJob?.status).toBe("PROCESSING");
            expect(updatedJob?.startedAt).toBeDefined();
        });

        it("transitions to COMPLETED on success", async () => {
            // Create a job
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Simulate successful completion
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "COMPLETED",
                    finishedAt: new Date().toISOString(),
                    summary: {
                        totalProducts: 5,
                        failedProducts: 0,
                        productsCreated: 5,
                        productsEnriched: 0,
                        productsSkipped: 0,
                    },
                })
                .where(eq(schema.importJobs.id, job.id));

            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            expect(updatedJob?.status).toBe("COMPLETED");
            expect(updatedJob?.finishedAt).toBeDefined();
            expect(updatedJob?.summary).toBeDefined();
            expect((updatedJob?.summary as Record<string, number>)?.totalProducts).toBe(5);
        });

        it("transitions to COMPLETED_WITH_FAILURES on partial success", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Simulate partial completion with some failures
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "COMPLETED_WITH_FAILURES",
                    finishedAt: new Date().toISOString(),
                    hasExportableFailures: true,
                    summary: {
                        totalProducts: 8,
                        failedProducts: 2,
                        productsCreated: 8,
                        productsEnriched: 0,
                        productsSkipped: 0,
                    },
                })
                .where(eq(schema.importJobs.id, job.id));

            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            expect(updatedJob?.status).toBe("COMPLETED_WITH_FAILURES");
            expect((updatedJob?.summary as Record<string, number>)?.failedProducts).toBe(2);
        });

        it("transitions to FAILED on critical error", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Simulate failure
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "FAILED",
                    finishedAt: new Date().toISOString(),
                    summary: {
                        error: "Invalid Excel file format",
                    },
                })
                .where(eq(schema.importJobs.id, job.id));

            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            expect(updatedJob?.status).toBe("FAILED");
            expect((updatedJob?.summary as Record<string, string>)?.error).toBe(
                "Invalid Excel file format"
            );
        });

        it("records timing information", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Record start time
            const startTime = new Date().toISOString();
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "PROCESSING",
                    startedAt: startTime,
                })
                .where(eq(schema.importJobs.id, job.id));

            // Simulate processing delay
            await new Promise((resolve) => setTimeout(resolve, 10));

            // Record finish time
            const finishTime = new Date().toISOString();
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "COMPLETED",
                    finishedAt: finishTime,
                })
                .where(eq(schema.importJobs.id, job.id));

            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            // Compare as Date objects to avoid format differences
            expect(new Date(updatedJob!.startedAt).getTime()).toBeDefined();
            expect(new Date(updatedJob!.finishedAt!).getTime()).toBeDefined();
            expect(new Date(updatedJob!.finishedAt!).getTime()).toBeGreaterThan(
                new Date(updatedJob!.startedAt).getTime()
            );
        });
    });

    describe("Job Mode Handling", () => {
        it("creates job with CREATE mode", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId, {
                mode: "CREATE",
            });

            expect(job.mode).toBe("CREATE");
        });

        it("creates job with CREATE_AND_ENRICH mode", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId, {
                mode: "CREATE_AND_ENRICH",
            });

            expect(job.mode).toBe("CREATE_AND_ENRICH");
        });
    });

    describe("Progress Tracking", () => {
        it("updates summary with product counts", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Update with progress summary
            await testDb
                .update(schema.importJobs)
                .set({
                    summary: {
                        totalProducts: 10,
                        failedProducts: 1,
                        productsCreated: 8,
                        productsEnriched: 1,
                        productsSkipped: 0,
                    },
                })
                .where(eq(schema.importJobs.id, job.id));

            const updatedJob = await TestDatabase.getImportJob(testDb, job.id);
            const summary = updatedJob?.summary as Record<string, number>;

            expect(summary.totalProducts).toBe(10);
            expect(summary.failedProducts).toBe(1);
            expect(summary.productsCreated).toBe(8);
            expect(summary.productsEnriched).toBe(1);
        });

        it("tracks exportable failures flag", async () => {
            const job = await TestDatabase.createImportJob(testDb, brandId);

            // Simulate job with exportable failures
            await testDb
                .update(schema.importJobs)
                .set({
                    status: "COMPLETED_WITH_FAILURES",
                    hasExportableFailures: true,
                })
                .where(eq(schema.importJobs.id, job.id));

            // Query using raw select to get hasExportableFailures
            const result = await testDb
                .select({ hasExportableFailures: schema.importJobs.hasExportableFailures })
                .from(schema.importJobs)
                .where(eq(schema.importJobs.id, job.id))
                .limit(1);

            expect(result[0]?.hasExportableFailures).toBe(true);
        });
    });
});
