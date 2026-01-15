/**
 * Integration Tests: Bulk Import TRPC Router
 *
 * Tests the import TRPC router endpoints:
 * - import.start: Create import job and trigger background processing
 * - import.status: Get job progress
 * - import.getRecentImports: Get job history
 * - import.dismiss: Clean up import data for failed imports
 *
 * Uses real database connections with mock Trigger.dev.
 *
 * Note: Updated to use import_rows table instead of staging tables
 * since the staging tables have been removed.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { NormalizedRowData } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import {
  TestDatabase,
  cleanupTables,
  createTestBrand,
  createTestUser,
  testDb,
} from "@v1/db/testing";
import { eq, sql } from "drizzle-orm";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";

// Mock Trigger.dev before importing the router
const mockTrigger = mock(() => Promise.resolve({ id: "mock-run-id" }));

// Mock the @trigger.dev/sdk/v3 module
mock.module("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: mockTrigger,
  },
}));

// Import the router after mocking
import { importRouter } from "../../../src/trpc/routers/bulk/import";

// Helper to create a mock caller context
function createMockContext(options: {
  brandId: string;
  userId: string;
  userEmail: string | null;
}): AuthenticatedTRPCContext & { brandId: string } {
  return {
    user: {
      id: options.userId,
      email: options.userEmail,
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: options.brandId,
    role: "owner" as const,
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

// Helper to call the import start mutation directly
async function callImportStart(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: {
    fileId: string;
    filename: string;
    mode: "CREATE" | "CREATE_AND_ENRICH";
  },
) {
  const result = await importRouter.createCaller(ctx).start(input);
  return result;
}

// Helper to call the import status query directly
async function callImportStatus(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: { jobId: string },
) {
  const result = await importRouter.createCaller(ctx).status(input);
  return result;
}

// Helper to call the getRecentImports query directly
async function callGetRecentImports(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: { limit?: number },
) {
  const result = await importRouter.createCaller(ctx).getRecentImports(input);
  return result;
}

// Helper to call the dismiss mutation directly
async function callDismiss(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: { jobId: string },
) {
  const result = await importRouter.createCaller(ctx).dismiss(input);
  return result;
}

// Helper to create normalized row data
function createNormalizedRowData(
  brandId: string,
  overrides: Partial<NormalizedRowData> = {},
): NormalizedRowData {
  const productId = crypto.randomUUID();
  const stagingId = crypto.randomUUID();
  const variantId = crypto.randomUUID();
  const variantStagingId = crypto.randomUUID();

  return {
    stagingId,
    rowNumber: 4,
    action: "CREATE",
    existingProductId: null,
    id: productId,
    brandId,
    productHandle: "test-product",
    name: "Test Product",
    description: null,
    imagePath: null,
    categoryId: null,
    seasonId: null,
    manufacturerId: null,
    status: "unpublished",
    rowStatus: "PENDING",
    errors: [],
    variants: [
      {
        stagingId: variantStagingId,
        rowNumber: 4,
        action: "CREATE",
        existingVariantId: null,
        id: variantId,
        productId,
        upid: null,
        barcode: null,
        sku: "TEST-SKU-001",
        nameOverride: null,
        descriptionOverride: null,
        imagePathOverride: null,
        rowStatus: "PENDING",
        errors: [],
        attributes: [],
        materials: [],
        ecoClaims: [],
        environment: null,
        journeySteps: [],
        weight: null,
        rawData: {},
      },
    ],
    tags: [],
    materials: [],
    ecoClaims: [],
    environment: null,
    journeySteps: [],
    weight: null,
    ...overrides,
  };
}

// Helper to get import row count
async function getImportRowCount(jobId: string): Promise<number> {
  const result = await testDb
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.importRows)
    .where(eq(schema.importRows.jobId, jobId));
  return result[0]?.count ?? 0;
}

describe("Bulk Import TRPC Router", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    // Reset mock call count
    mockTrigger.mockClear();
    await cleanupTables();

    // Create unique email for each test to avoid conflicts
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    userEmail = `test-import-${uniqueSuffix}@example.com`;

    // Create a test brand and user for each test
    brandId = await createTestBrand("Import Router Test Brand");
    userId = await createTestUser(userEmail);

    // Create brand membership so the TRPC middleware can resolve the brand context
    // The ensureBrandContext middleware checks brandMembers to verify access
    await testDb.insert(schema.brandMembers).values({
      userId,
      brandId,
      role: "owner",
    });
  });

  describe("import.start", () => {
    it("creates import job and returns jobId", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const timestamp = Date.now();
      const filename = "test-import.xlsx";
      const fileId = `${brandId}/${timestamp}-${filename}`;

      const result = await callImportStart(ctx, {
        fileId,
        filename,
        mode: "CREATE",
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe("string");
      expect(result.status).toBe("PENDING");
      expect(result.createdAt).toBeDefined();

      // Verify Trigger.dev was called
      expect(mockTrigger).toHaveBeenCalledTimes(1);
      expect(mockTrigger).toHaveBeenCalledWith(
        "validate-and-stage",
        expect.objectContaining({
          jobId: result.jobId,
          brandId,
          mode: "CREATE",
        }),
      );
    });

    it("validates file belongs to brand", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const otherBrandId = "other-brand-id";
      const timestamp = Date.now();
      const filename = "test-import.xlsx";
      const fileId = `${otherBrandId}/${timestamp}-${filename}`;

      await expect(
        callImportStart(ctx, {
          fileId,
          filename,
          mode: "CREATE",
        }),
      ).rejects.toThrow("File does not belong to the active brand");
    });
  });

  describe("import.status", () => {
    it("returns job progress", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create a job with progress
      const job = await TestDatabase.createImportJob(testDb, brandId, {
        status: "VALIDATING",
      });

      // Update with progress summary
      await testDb
        .update(schema.importJobs)
        .set({
          summary: {
            total: 100,
            processed: 50,
          },
        })
        .where(eq(schema.importJobs.id, job.id));

      const result = await callImportStatus(ctx, { jobId: job.id });

      expect(result).toBeDefined();
      expect(result.jobId).toBe(job.id);
      expect(result.status).toBe("VALIDATING");
      expect(result.progress).toEqual({
        phase: "validation",
        total: 100,
        processed: 50,
        created: 0,
        updated: 0,
        failed: 0,
        percentage: 50,
      });
    });

    it("throws for non-existent job", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        callImportStatus(ctx, {
          jobId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("Import job not found");
    });

    it("prevents cross-brand access", async () => {
      // Create a job under a different brand
      const otherBrandId = await createTestBrand("Other Brand");

      const job = await TestDatabase.createImportJob(testDb, otherBrandId);

      // Try to access from our brand
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(callImportStatus(ctx, { jobId: job.id })).rejects.toThrow(
        "Access denied: job belongs to different brand",
      );
    });
  });

  describe("import.getRecentImports", () => {
    it("returns job history", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create multiple jobs
      await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-1.xlsx",
      });
      await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-2.xlsx",
      });
      await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-3.xlsx",
      });

      const result = await callGetRecentImports(ctx, { limit: 10 });

      expect(result).toBeDefined();
      expect(result.jobs).toHaveLength(3);
    });

    it("respects limit parameter", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create multiple jobs
      for (let i = 0; i < 5; i++) {
        await TestDatabase.createImportJob(testDb, brandId, {
          filename: `import-${i}.xlsx`,
        });
      }

      const result = await callGetRecentImports(ctx, { limit: 2 });

      expect(result.jobs).toHaveLength(2);
    });
  });

  describe("import.dismiss", () => {
    it("cleans up failed import data", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create a failed job
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Update to failed status
      await testDb
        .update(schema.importJobs)
        .set({
          status: "COMPLETED_WITH_FAILURES",
          hasExportableFailures: true,
        })
        .where(eq(schema.importJobs.id, job.id));

      // Add import row data (replaces staging data)
      const normalized = createNormalizedRowData(brandId, {
        productHandle: "failed-product",
        name: "Failed Product",
        rowStatus: "BLOCKED",
        errors: [{ field: "Category", message: "Category not found" }],
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "failed-product" },
        normalized,
        status: "BLOCKED",
      });

      const result = await callDismiss(ctx, { jobId: job.id });

      expect(result.success).toBe(true);
      expect(result.message).toContain("dismissed");

      // Verify import rows were cleaned up
      const importRowCount = await getImportRowCount(job.id);
      expect(importRowCount).toBe(0);
    });

    it("enforces brand ownership", async () => {
      // Create a job under a different brand
      const otherBrandId = await createTestBrand("Other Brand");

      const job = await TestDatabase.createImportJob(testDb, otherBrandId);

      // Update to failed status so it's dismissable
      await testDb
        .update(schema.importJobs)
        .set({
          status: "FAILED",
        })
        .where(eq(schema.importJobs.id, job.id));

      // Try to dismiss from our brand
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(callDismiss(ctx, { jobId: job.id })).rejects.toThrow(
        "Access denied: job belongs to different brand",
      );
    });
  });
});
