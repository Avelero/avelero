/**
 * Integration Tests: Bulk Export TRPC Router
 *
 * Tests the export TRPC router endpoints:
 * - export.start: Create export job and trigger background processing
 * - export.status: Get job progress and download URL
 *
 * Uses real database connections with mock Trigger.dev.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as schema from "@v1/db/schema";
import { cleanupTables, createTestBrand, testDb } from "@v1/db/testing";
import { createTestExportJob, createTestUser } from "@v1/db/testing";
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
import { exportRouter } from "../../../src/trpc/routers/bulk/export";

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

// Helper to call the export start mutation directly
async function callExportStart(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: {
    selection:
      | { mode: "all"; excludeIds?: string[] }
      | { mode: "explicit"; includeIds: string[] };
    filterState?: any;
    search?: string;
  },
) {
  // Use the router's createCaller pattern
  const { createCallerFactory } = await import("../../../src/trpc/init");
  const createCaller = createCallerFactory({
    bulk: { export: exportRouter },
  } as any);
  const caller = createCaller(ctx);

  // Since we're testing the router directly, we need to call the procedure
  // We'll test via the exported router's procedures
  const result = await exportRouter.createCaller(ctx).start(input);
  return result;
}

// Helper to call the export status query directly
async function callExportStatus(
  ctx: AuthenticatedTRPCContext & { brandId: string },
  input: { jobId: string },
) {
  const result = await exportRouter.createCaller(ctx).status(input);
  return result;
}

describe("Bulk Export TRPC Router", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    // Reset mock call count
    mockTrigger.mockClear();

    // Clean database between tests to avoid duplicate key violations
    await cleanupTables();

    // Create unique email for each test to avoid conflicts
    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    userEmail = `test-${uniqueSuffix}@example.com`;

    // Create a test brand and user for each test
    brandId = await createTestBrand("Export Router Test Brand");
    userId = await createTestUser(userEmail);

    // Create brand membership so the TRPC middleware can resolve the brand context
    // The ensureBrandContext middleware checks brandMembers to verify access
    await testDb.insert(schema.brandMembers).values({
      userId,
      brandId,
      role: "owner",
    });
  });

  describe("export.start", () => {
    it("creates export job and returns jobId", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      const result = await callExportStart(ctx, {
        selection: { mode: "all" },
      });

      expect(result).toBeDefined();
      expect(result.jobId).toBeDefined();
      expect(typeof result.jobId).toBe("string");
      expect(result.status).toBe("PENDING");
      expect(result.createdAt).toBeDefined();

      // Verify Trigger.dev was called
      expect(mockTrigger).toHaveBeenCalledTimes(1);
      expect(mockTrigger).toHaveBeenCalledWith(
        "export-products",
        expect.objectContaining({
          jobId: result.jobId,
          brandId,
          userEmail,
          selectionMode: "all",
        }),
      );
    });

    it("requires user email", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail: null });

      await expect(
        callExportStart(ctx, {
          selection: { mode: "all" },
        }),
      ).rejects.toThrow("User email is required");
    });

    it("handles Trigger.dev failure gracefully", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Make trigger fail
      mockTrigger.mockImplementationOnce(() =>
        Promise.reject(new Error("Trigger.dev connection failed")),
      );

      await expect(
        callExportStart(ctx, {
          selection: { mode: "all" },
        }),
      ).rejects.toThrow("Failed to start export job");
    });

    it("stores explicit selection mode with includeIds", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const includeIds = [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
        "33333333-3333-3333-3333-333333333333",
      ];

      const result = await callExportStart(ctx, {
        selection: { mode: "explicit", includeIds },
      });

      // Verify the job was created with correct selection
      expect(mockTrigger).toHaveBeenCalledWith(
        "export-products",
        expect.objectContaining({
          selectionMode: "explicit",
          includeIds,
          excludeIds: [],
        }),
      );
    });

    it("stores all mode with excludeIds", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const excludeIds = [
        "44444444-4444-4444-4444-444444444444",
        "55555555-5555-5555-5555-555555555555",
      ];

      const result = await callExportStart(ctx, {
        selection: { mode: "all", excludeIds },
      });

      // Verify the job was created with correct selection
      expect(mockTrigger).toHaveBeenCalledWith(
        "export-products",
        expect.objectContaining({
          selectionMode: "all",
          includeIds: [],
          excludeIds,
        }),
      );
    });
  });

  describe("export.status", () => {
    it("returns progress with percentage", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create a job with progress
      const jobId = await createTestExportJob(brandId, userId, userEmail, {
        status: "PROCESSING",
        totalProducts: 100,
        productsProcessed: 50,
      });

      const result = await callExportStatus(ctx, { jobId });

      expect(result).toBeDefined();
      expect(result.jobId).toBe(jobId);
      expect(result.status).toBe("PROCESSING");
      expect(result.progress).toEqual({
        total: 100,
        processed: 50,
        percentage: 50,
      });
    });

    it("returns downloadUrl when COMPLETED", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });
      const downloadUrl = "https://storage.example.com/exports/test-file.xlsx";
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();

      // Create a completed job
      const jobId = await createTestExportJob(brandId, userId, userEmail, {
        status: "COMPLETED",
        totalProducts: 100,
        productsProcessed: 100,
        downloadUrl,
        expiresAt,
      });

      const result = await callExportStatus(ctx, { jobId });

      expect(result.status).toBe("COMPLETED");
      expect(result.downloadUrl).toBe(downloadUrl);
      expect(result.expiresAt).toBeDefined();
      expect(result.progress.percentage).toBe(100);
    });

    it("throws for non-existent job", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        callExportStatus(ctx, {
          jobId: "00000000-0000-0000-0000-000000000000",
        }),
      ).rejects.toThrow("Export job not found");
    });

    it("prevents cross-brand access", async () => {
      // Create a job under a different brand with a unique email
      const otherUniqueSuffix = Math.random().toString(36).substring(2, 10);
      const otherEmail = `other-${otherUniqueSuffix}@example.com`;
      const otherBrandId = await createTestBrand("Other Brand");
      const otherUserId = await createTestUser(otherEmail);

      const jobId = await createTestExportJob(
        otherBrandId,
        otherUserId,
        otherEmail,
        {
          status: "COMPLETED",
        },
      );

      // Try to access from our brand
      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(callExportStatus(ctx, { jobId })).rejects.toThrow(
        "Access denied: job belongs to different brand",
      );
    });

    it("progress percentage rounds to integer", async () => {
      const ctx = createMockContext({ brandId, userId, userEmail });

      // Create a job with non-round progress (33/100 = 33.33...)
      const jobId = await createTestExportJob(brandId, userId, userEmail, {
        status: "PROCESSING",
        totalProducts: 100,
        productsProcessed: 33,
      });

      const result = await callExportStatus(ctx, { jobId });

      // Should round to integer
      expect(result.progress.percentage).toBe(33);
      expect(Number.isInteger(result.progress.percentage)).toBe(true);
    });
  });
});
