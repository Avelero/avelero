/**
 * Integration Tests: Bulk QR Export TRPC Router
 *
 * Tests the qrExport TRPC router endpoints:
 * - qrExport.start
 * - qrExport.status
 */

import "../../setup";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import { getQrExportJobStatus } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import {
  createTestBrand,
  createTestProductForExport,
  createTestQrExportJob,
  createTestUser,
  createTestVariantWithOverrides,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";

const mockTrigger = mock(() => Promise.resolve({ id: "mock-run-id" }));
const mockCreatePublicToken = mock(() => Promise.resolve("mock-public-token"));

mock.module("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: mockTrigger,
  },
  auth: {
    createPublicToken: mockCreatePublicToken,
  },
}));

import { qrExportRouter } from "../../../src/trpc/routers/bulk/qr-export";
import { productsRouter } from "../../../src/trpc/routers/products";

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

async function createBrandMembership(userId: string, brandId: string) {
  await testDb.insert(schema.brandMembers).values({
    userId,
    brandId,
    role: "owner",
  });
}

async function createCustomDomain(options: {
  brandId: string;
  domain: string;
  status: "pending" | "verified";
}) {
  await testDb.insert(schema.brandCustomDomains).values({
    brandId: options.brandId,
    domain: options.domain,
    status: options.status,
    verificationToken: "avelero-verify-test-token",
    verifiedAt: options.status === "verified" ? new Date().toISOString() : null,
  });
}

describe("Bulk QR Export Router", () => {
  let brandId: string;
  let userId: string;
  let userEmail: string;

  beforeEach(async () => {
    mockTrigger.mockClear();
    mockCreatePublicToken.mockClear();

    const uniqueSuffix = Math.random().toString(36).substring(2, 10);
    userEmail = `test-${uniqueSuffix}@example.com`;
    brandId = await createTestBrand("QR Export Router Test Brand");
    userId = await createTestUser(userEmail);
    await createBrandMembership(userId, brandId);
  });

  describe("qrExport.start", () => {
    it("rejects when custom domain is missing", async () => {
      const productId = await createTestProductForExport(brandId, {
        name: "Missing Domain Product",
      });
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "1234567890123",
      });

      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        qrExportRouter.createCaller(ctx).start({
          selection: { mode: "explicit", includeIds: [productId] },
        }),
      ).rejects.toThrow("verified custom domain");

      expect(mockTrigger).toHaveBeenCalledTimes(0);
    });

    it("rejects when custom domain is pending", async () => {
      const productId = await createTestProductForExport(brandId, {
        name: "Pending Domain Product",
      });
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "1234567890123",
      });
      await createCustomDomain({
        brandId,
        domain: "passport.pending.example.com",
        status: "pending",
      });

      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        qrExportRouter.createCaller(ctx).start({
          selection: { mode: "explicit", includeIds: [productId] },
        }),
      ).rejects.toThrow("verified custom domain");

      expect(mockTrigger).toHaveBeenCalledTimes(0);
    });

    it("rejects when no barcode-eligible variants exist", async () => {
      const productId = await createTestProductForExport(brandId, {
        name: "No Barcode Product",
      });
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "",
      });
      await createCustomDomain({
        brandId,
        domain: "passport.example.com",
        status: "verified",
      });

      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        qrExportRouter.createCaller(ctx).start({
          selection: { mode: "explicit", includeIds: [productId] },
        }),
      ).rejects.toThrow("No eligible variants found");

      expect(mockTrigger).toHaveBeenCalledTimes(0);
    });

    it("starts job and returns job metadata when domain is verified", async () => {
      const productId = await createTestProductForExport(brandId, {
        name: "QR Export Product",
      });
      await createTestVariantWithOverrides(productId, brandId, {
        barcode: "1234567890123",
      });
      await createCustomDomain({
        brandId,
        domain: "passport.example.com",
        status: "verified",
      });

      const ctx = createMockContext({ brandId, userId, userEmail });
      const result = await qrExportRouter.createCaller(ctx).start({
        selection: { mode: "explicit", includeIds: [productId] },
      });

      expect(result.jobId).toBeDefined();
      expect(result.runId).toBe("mock-run-id");
      expect(result.publicAccessToken).toBe("mock-public-token");
      expect(result.status).toBe("PENDING");

      expect(mockTrigger).toHaveBeenCalledTimes(1);
      expect(mockTrigger).toHaveBeenCalledWith(
        "export-qr-codes",
        expect.objectContaining({
          jobId: result.jobId,
          brandId,
          customDomain: "passport.example.com",
        }),
      );
    });

    it("keeps summary and job counters consistent for all+exclude selection", async () => {
      const productA = await createTestProductForExport(brandId, { name: "A" });
      const productB = await createTestProductForExport(brandId, { name: "B" });
      const productC = await createTestProductForExport(brandId, { name: "C" });

      await createTestVariantWithOverrides(productA, brandId, {
        barcode: "1234567890123",
      });
      await createTestVariantWithOverrides(productB, brandId, {
        barcode: "2234567890123",
      });
      await createTestVariantWithOverrides(productC, brandId, {
        barcode: "3234567890123",
      });

      await createCustomDomain({
        brandId,
        domain: "passport.example.com",
        status: "verified",
      });

      const ctx = createMockContext({ brandId, userId, userEmail });
      const summaryResponse = await productsRouter.createCaller(ctx).count({
        selection: { mode: "all", excludeIds: [productC] },
      });
      const summary = summaryResponse.data;
      const started = await qrExportRouter.createCaller(ctx).start({
        selection: { mode: "all", excludeIds: [productC] },
      });

      const job = await getQrExportJobStatus(testDb, started.jobId);
      expect(job).not.toBeNull();
      expect(job?.totalProducts).toBe(summary.selectedProducts);
      expect(job?.totalVariants).toBe(summary.selectedVariants);
      expect(job?.eligibleVariants).toBe(summary.variantsWithBarcode);
    });
  });

  describe("qrExport.status", () => {
    it("denies cross-brand status reads", async () => {
      const otherBrandId = await createTestBrand("Other QR Brand");
      const otherEmail = `other-${Math.random().toString(36).substring(2, 10)}@example.com`;
      const otherUserId = await createTestUser(otherEmail);
      await createBrandMembership(otherUserId, otherBrandId);

      const foreignJobId = await createTestQrExportJob(
        otherBrandId,
        otherUserId,
        otherEmail,
        {
          status: "COMPLETED",
          customDomain: "passport.other.example.com",
        },
      );

      const ctx = createMockContext({ brandId, userId, userEmail });

      await expect(
        qrExportRouter.createCaller(ctx).status({ jobId: foreignJobId }),
      ).rejects.toThrow("Access denied");
    });
  });
});
