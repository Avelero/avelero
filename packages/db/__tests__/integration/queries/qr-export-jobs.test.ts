/**
 * Integration Tests: QR Export Job CRUD
 *
 * Tests the QR export job database query functions:
 * - createQrExportJob
 * - updateQrExportJobStatus
 * - getQrExportJobStatus
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  createQrExportJob,
  getQrExportJobStatus,
  updateQrExportJobStatus,
} from "@v1/db/queries/bulk";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";

describe("QR Export Job CRUD", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    userEmail = `test-${uniqueSuffix}@example.com`;
    brandId = await createTestBrand("QR Export Test Brand");
    userId = await createTestUser(userEmail);
  });

  it("creates job with pending defaults", async () => {
    const result = await createQrExportJob(testDb, {
      brandId,
      userId,
      userEmail,
      selectionMode: "all",
      includeIds: [],
      excludeIds: [],
      filterState: null,
      searchQuery: null,
      customDomain: "passport.example.com",
    });

    expect(result.status).toBe("PENDING");
    expect(result.totalProducts).toBe(0);
    expect(result.totalVariants).toBe(0);
    expect(result.eligibleVariants).toBe(0);
    expect(result.variantsProcessed).toBe(0);
    expect(result.startedAt).toBeDefined();
    expect(result.finishedAt).toBeNull();
  });

  it("updates progress fields", async () => {
    const created = await createQrExportJob(testDb, {
      brandId,
      userId,
      userEmail,
      selectionMode: "all",
      includeIds: [],
      excludeIds: [],
      filterState: null,
      searchQuery: null,
      customDomain: "passport.example.com",
      status: "PROCESSING",
      eligibleVariants: 10,
    });

    const updated = await updateQrExportJobStatus(testDb, {
      jobId: created.id,
      totalProducts: 4,
      totalVariants: 18,
      eligibleVariants: 10,
      variantsProcessed: 6,
    });

    expect(updated.totalProducts).toBe(4);
    expect(updated.totalVariants).toBe(18);
    expect(updated.eligibleVariants).toBe(10);
    expect(updated.variantsProcessed).toBe(6);
    expect((updated.variantsProcessed ?? 0) <= (updated.eligibleVariants ?? 0)).toBe(
      true,
    );
  });

  it("persists completion fields and summary", async () => {
    const created = await createQrExportJob(testDb, {
      brandId,
      userId,
      userEmail,
      selectionMode: "explicit",
      includeIds: ["a", "b"],
      excludeIds: [],
      filterState: { status: "published" },
      searchQuery: "shirt",
      customDomain: "passport.example.com",
      status: "PROCESSING",
    });

    const finishedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const updated = await updateQrExportJobStatus(testDb, {
      jobId: created.id,
      status: "COMPLETED",
      totalProducts: 12,
      totalVariants: 34,
      eligibleVariants: 21,
      variantsProcessed: 21,
      filePath: `${brandId}/${created.id}/qr-code-export.csv`,
      downloadUrl: "https://storage.example.com/qr-export.csv",
      expiresAt,
      finishedAt,
      summary: {
        selectedProducts: 12,
        selectedVariants: 34,
        successfulVariants: 21,
        failedVariantsCount: 0,
      },
    });

    expect(updated.status).toBe("COMPLETED");
    expect(updated.filePath).toContain(`${brandId}/${created.id}/`);
    expect(updated.downloadUrl).toBe("https://storage.example.com/qr-export.csv");
    expect(new Date(updated.expiresAt!).getTime()).toBe(new Date(expiresAt).getTime());
    expect(new Date(updated.finishedAt!).getTime()).toBe(
      new Date(finishedAt).getTime(),
    );
    expect(updated.summary).toEqual({
      selectedProducts: 12,
      selectedVariants: 34,
      successfulVariants: 21,
      failedVariantsCount: 0,
    });
  });

  it("persists failed status and error summary", async () => {
    const created = await createQrExportJob(testDb, {
      brandId,
      userId,
      userEmail,
      selectionMode: "all",
      includeIds: [],
      excludeIds: [],
      filterState: null,
      searchQuery: null,
      customDomain: "passport.example.com",
      status: "PROCESSING",
    });

    const finishedAt = new Date().toISOString();
    const updated = await updateQrExportJobStatus(testDb, {
      jobId: created.id,
      status: "FAILED",
      finishedAt,
      summary: {
        error: "Storage upload failed",
        failedVariantsCount: 3,
      },
    });

    expect(updated.status).toBe("FAILED");
    expect(updated.finishedAt).toBeDefined();
    expect(new Date(updated.finishedAt!).getTime()).toBe(
      new Date(finishedAt).getTime(),
    );
    expect(updated.summary).toEqual({
      error: "Storage upload failed",
      failedVariantsCount: 3,
    });

    const loaded = await getQrExportJobStatus(testDb, created.id);
    expect(loaded?.status).toBe("FAILED");
  });
});
