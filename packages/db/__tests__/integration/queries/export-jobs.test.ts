/**
 * Integration Tests: Export Job CRUD
 *
 * Tests the export job database query functions:
 * - createExportJob
 * - updateExportJobStatus
 * - getExportJobStatus
 *
 * Uses real database connections with cleanup between tests.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { createTestBrand, testDb } from "@v1/testing/db";
import { createTestExportJob, createTestUser } from "@v1/testing/db/export";
import {
    createExportJob,
    updateExportJobStatus,
    getExportJobStatus,
} from "@v1/db/queries/bulk";

describe("Export Job CRUD", () => {
    let brandId: string;
    let userId: string;
    const userEmail = "test@example.com";

    beforeEach(async () => {
        // Create a test brand and user for each test
        brandId = await createTestBrand("Export Test Brand");
        userId = await createTestUser(userEmail);
    });

    describe("createExportJob()", () => {
        it("creates job with PENDING status by default", async () => {
            const result = await createExportJob(testDb, {
                brandId,
                userId,
                userEmail,
                selectionMode: "all",
                includeIds: [],
                excludeIds: [],
                filterState: null,
                searchQuery: null,
            });

            expect(result).toBeDefined();
            expect(result.id).toBeDefined();
            expect(result.status).toBe("PENDING");
            expect(result.brandId).toBe(brandId);
            expect(result.userId).toBe(userId);
            expect(result.userEmail).toBe(userEmail);
        });

        it("stores selection mode and IDs correctly", async () => {
            const includeIds = ["prod-1", "prod-2", "prod-3"];
            const excludeIds = ["prod-4"];
            const filterState = { status: "published" };

            const result = await createExportJob(testDb, {
                brandId,
                userId,
                userEmail,
                selectionMode: "explicit",
                includeIds,
                excludeIds,
                filterState,
                searchQuery: "test query",
            });

            expect(result.selectionMode).toBe("explicit");
            expect(result.includeIds).toEqual(includeIds);
            expect(result.excludeIds).toEqual(excludeIds);
            expect(result.filterState).toEqual(filterState);
            expect(result.searchQuery).toBe("test query");
        });

        it("allows custom initial status", async () => {
            const result = await createExportJob(testDb, {
                brandId,
                userId,
                userEmail,
                selectionMode: "all",
                includeIds: [],
                excludeIds: [],
                filterState: null,
                searchQuery: null,
                status: "PROCESSING",
            });

            expect(result.status).toBe("PROCESSING");
        });
    });

    describe("updateExportJobStatus()", () => {
        it("updates only status when provided", async () => {
            const jobId = await createTestExportJob(brandId, userId, userEmail, {
                status: "PENDING",
            });

            const result = await updateExportJobStatus(testDb, {
                jobId,
                status: "PROCESSING",
            });

            expect(result.status).toBe("PROCESSING");
            // Other fields should remain unchanged
            expect(result.totalProducts).toBe(0);
            expect(result.productsProcessed).toBe(0);
        });

        it("updates progress fields", async () => {
            const jobId = await createTestExportJob(brandId, userId, userEmail, {
                status: "PROCESSING",
            });

            const result = await updateExportJobStatus(testDb, {
                jobId,
                totalProducts: 100,
                productsProcessed: 50,
            });

            expect(result.totalProducts).toBe(100);
            expect(result.productsProcessed).toBe(50);
        });

        it("updates completion fields", async () => {
            const jobId = await createTestExportJob(brandId, userId, userEmail, {
                status: "PROCESSING",
            });

            const finishedAt = new Date().toISOString();
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

            const result = await updateExportJobStatus(testDb, {
                jobId,
                status: "COMPLETED",
                filePath: "exports/test-file.xlsx",
                downloadUrl: "https://storage.example.com/exports/test-file.xlsx",
                expiresAt,
                finishedAt,
                summary: { totalProducts: 42, totalVariants: 100 },
            });

            expect(result.status).toBe("COMPLETED");
            expect(result.filePath).toBe("exports/test-file.xlsx");
            expect(result.downloadUrl).toBe("https://storage.example.com/exports/test-file.xlsx");
            expect(result.expiresAt).toBe(expiresAt);
            expect(result.finishedAt).toBe(finishedAt);
            expect(result.summary).toEqual({ totalProducts: 42, totalVariants: 100 });
        });

        it("throws for non-existent job", async () => {
            await expect(
                updateExportJobStatus(testDb, {
                    jobId: "non-existent-job-id",
                    status: "COMPLETED",
                })
            ).rejects.toThrow("Export job not found: non-existent-job-id");
        });
    });

    describe("getExportJobStatus()", () => {
        it("returns null for non-existent job", async () => {
            const result = await getExportJobStatus(testDb, "non-existent-job-id");

            expect(result).toBeNull();
        });

        it("returns complete job data", async () => {
            const jobId = await createTestExportJob(brandId, userId, userEmail, {
                status: "COMPLETED",
                selectionMode: "explicit",
                includeIds: ["prod-1", "prod-2"],
                excludeIds: [],
                filterState: { status: "published" },
                searchQuery: "test search",
                totalProducts: 100,
                productsProcessed: 100,
                filePath: "exports/completed.xlsx",
                downloadUrl: "https://storage.example.com/exports/completed.xlsx",
            });

            const result = await getExportJobStatus(testDb, jobId);

            expect(result).not.toBeNull();
            expect(result!.id).toBe(jobId);
            expect(result!.brandId).toBe(brandId);
            expect(result!.userId).toBe(userId);
            expect(result!.userEmail).toBe(userEmail);
            expect(result!.status).toBe("COMPLETED");
            expect(result!.selectionMode).toBe("explicit");
            expect(result!.includeIds).toEqual(["prod-1", "prod-2"]);
            expect(result!.excludeIds).toEqual([]);
            expect(result!.filterState).toEqual({ status: "published" });
            expect(result!.searchQuery).toBe("test search");
            expect(result!.totalProducts).toBe(100);
            expect(result!.productsProcessed).toBe(100);
            expect(result!.filePath).toBe("exports/completed.xlsx");
            expect(result!.downloadUrl).toBe("https://storage.example.com/exports/completed.xlsx");
            expect(result!.startedAt).toBeDefined();
        });
    });
});
