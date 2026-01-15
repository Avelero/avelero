/**
 * Integration Tests: Import Rows Flow
 *
 * Tests the import_rows table operations during import.
 * Validates that products and variants are correctly stored as normalized
 * JSONB data before commit to production tables.
 *
 * Note: This replaces the old staging-flow tests. The new architecture stores
 * all validated data in import_rows.normalized JSONB instead of separate
 * staging tables.
 *
 * @module tests/integration/import/import-rows-flow
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import type { NormalizedRowData, NormalizedVariant } from "@v1/db/queries/bulk";
import * as schema from "@v1/db/schema";
import {
  type InsertedCatalog,
  TestCatalog,
  TestDatabase,
  cleanupTables,
  createTestBrand,
  testDb,
} from "@v1/db/testing";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

describe("Import Rows Flow", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  /**
   * Helper to create a normalized product row for testing
   */
  function createNormalizedRowData(
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

  /**
   * Helper to get import rows for a job
   */
  async function getImportRows(jobId: string) {
    return testDb
      .select()
      .from(schema.importRows)
      .where(eq(schema.importRows.jobId, jobId))
      .orderBy(asc(schema.importRows.rowNumber));
  }

  /**
   * Helper to get import row count for a job
   */
  async function getImportRowCount(jobId: string): Promise<number> {
    const result = await testDb
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.importRows)
      .where(eq(schema.importRows.jobId, jobId));
    return result[0]?.count ?? 0;
  }

  /**
   * Helper to get import rows by status
   */
  async function getImportRowsByStatus(jobId: string, status: string) {
    return testDb
      .select()
      .from(schema.importRows)
      .where(
        and(
          eq(schema.importRows.jobId, jobId),
          eq(schema.importRows.status, status),
        ),
      )
      .orderBy(asc(schema.importRows.rowNumber));
  }

  describe("Import Row Creation", () => {
    it("creates import row records with normalized data", async () => {
      // Create a job
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create normalized data
      const normalized = createNormalizedRowData({
        productHandle: "test-product",
        rowNumber: 4,
        rowStatus: "PENDING",
      });

      // Insert import row with normalized data
      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: {
          "Product Title": "Test Product",
          "Product Handle": "test-product",
        },
        normalized,
        status: "PENDING",
      });

      // Verify import row was created
      const rows = await getImportRows(job.id);

      expect(rows).toHaveLength(1);
      expect(rows[0]?.status).toBe("PENDING");
      expect(rows[0]?.rowNumber).toBe(4);

      // Verify normalized data
      const normalizedData = rows[0]?.normalized as NormalizedRowData;
      expect(normalizedData.productHandle).toBe("test-product");
      expect(normalizedData.name).toBe("Test Product");
      expect(normalizedData.variants).toHaveLength(1);
    });

    it("stores variant data in normalized JSONB", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        variants: [
          {
            stagingId: crypto.randomUUID(),
            rowNumber: 4,
            action: "CREATE",
            existingVariantId: null,
            id: crypto.randomUUID(),
            productId: crypto.randomUUID(),
            upid: null,
            barcode: "1234567890123",
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
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { SKU: "TEST-SKU-001", Barcode: "1234567890123" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      const normalizedData = rows[0]?.normalized as NormalizedRowData;

      expect(normalizedData.variants).toHaveLength(1);
      expect(normalizedData.variants[0]?.sku).toBe("TEST-SKU-001");
      expect(normalizedData.variants[0]?.barcode).toBe("1234567890123");
    });

    it("tracks row numbers in import rows", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create multiple import rows with different row numbers
      const products = [
        { row: 4, handle: "product-1" },
        { row: 5, handle: "product-2" },
        { row: 6, handle: "product-3" },
      ];

      for (const p of products) {
        const normalized = createNormalizedRowData({
          rowNumber: p.row,
          productHandle: p.handle,
          name: `Product ${p.row}`,
        });

        await testDb.insert(schema.importRows).values({
          jobId: job.id,
          rowNumber: p.row,
          raw: { "Product Handle": p.handle },
          normalized,
          status: "PENDING",
        });
      }

      const rows = await getImportRows(job.id);

      expect(rows).toHaveLength(3);

      // Verify row numbers are preserved
      const rowNumbers = rows.map((r) => r.rowNumber).sort();
      expect(rowNumbers).toEqual([4, 5, 6]);
    });
  });

  describe("Import Row Status Tracking", () => {
    it("marks import rows as PENDING initially", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({ rowStatus: "PENDING" });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Title": "Test Product" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      expect(rows[0]?.status).toBe("PENDING");
    });

    it("marks import rows as COMMITTED after commit", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData();

      const [insertedRow] = await testDb
        .insert(schema.importRows)
        .values({
          jobId: job.id,
          rowNumber: 4,
          raw: { "Product Title": "Test Product" },
          normalized,
          status: "PENDING",
        })
        .returning();

      // Simulate commit by updating status
      await testDb
        .update(schema.importRows)
        .set({ status: "COMMITTED" })
        .where(eq(schema.importRows.id, insertedRow!.id));

      const rows = await getImportRows(job.id);
      expect(rows[0]?.status).toBe("COMMITTED");
    });

    it("marks import rows as FAILED on error", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        rowStatus: "PENDING_WITH_WARNINGS",
        errors: [{ field: "Category", message: "Category not found" }],
      });

      const [insertedRow] = await testDb
        .insert(schema.importRows)
        .values({
          jobId: job.id,
          rowNumber: 4,
          raw: { "Product Title": "Test Product" },
          normalized,
          status: "PENDING_WITH_WARNINGS",
        })
        .returning();

      // Simulate failure
      await testDb
        .update(schema.importRows)
        .set({ status: "FAILED", error: "Database error" })
        .where(eq(schema.importRows.id, insertedRow!.id));

      const rows = await getImportRows(job.id);
      expect(rows[0]?.status).toBe("FAILED");
      expect(rows[0]?.error).toBe("Database error");
    });

    it("stores BLOCKED rows that cannot be committed", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        rowStatus: "BLOCKED",
        errors: [{ field: "Product Title", message: "Required" }],
        name: "", // Missing required title
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "test-product" },
        normalized,
        status: "BLOCKED",
      });

      const rows = await getImportRowsByStatus(job.id, "BLOCKED");
      expect(rows).toHaveLength(1);

      const normalizedData = rows[0]?.normalized as NormalizedRowData;
      expect(normalizedData.rowStatus).toBe("BLOCKED");
      expect(normalizedData.errors).toHaveLength(1);
      expect(normalizedData.errors[0]?.field).toBe("Product Title");
    });
  });

  describe("Import Row Counts", () => {
    it("counts import rows for a job", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create multiple import rows
      for (let i = 0; i < 5; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `product-${i}`,
          name: `Product ${i}`,
        });

        await testDb.insert(schema.importRows).values({
          jobId: job.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `product-${i}` },
          normalized,
          status: "PENDING",
        });
      }

      const rowCount = await getImportRowCount(job.id);
      expect(rowCount).toBe(5);
    });

    it("counts variants within normalized data", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create product with multiple variants
      const productId = crypto.randomUUID();
      const variants: NormalizedVariant[] = [];
      for (let i = 0; i < 3; i++) {
        variants.push({
          stagingId: crypto.randomUUID(),
          rowNumber: 4 + i,
          action: "CREATE",
          existingVariantId: null,
          id: crypto.randomUUID(),
          productId,
          upid: null,
          barcode: null,
          sku: `SKU-${i}`,
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
        });
      }

      const normalized = createNormalizedRowData({
        id: productId,
        variants,
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "test-product" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      const normalizedData = rows[0]?.normalized as NormalizedRowData;

      expect(normalizedData.variants).toHaveLength(3);
    });
  });

  describe("Multi-Job Isolation", () => {
    it("isolates import rows between jobs", async () => {
      // Create two jobs
      const job1 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-1.xlsx",
      });
      const job2 = await TestDatabase.createImportJob(testDb, brandId, {
        filename: "import-2.xlsx",
      });

      // Add rows to job 1
      for (let i = 0; i < 3; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `job1-product-${i}`,
          name: `Job1 Product ${i}`,
        });

        await testDb.insert(schema.importRows).values({
          jobId: job1.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `job1-product-${i}` },
          normalized,
          status: "PENDING",
        });
      }

      // Add rows to job 2
      for (let i = 0; i < 2; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `job2-product-${i}`,
          name: `Job2 Product ${i}`,
        });

        await testDb.insert(schema.importRows).values({
          jobId: job2.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `job2-product-${i}` },
          normalized,
          status: "PENDING",
        });
      }

      // Verify counts are isolated
      const job1Count = await getImportRowCount(job1.id);
      const job2Count = await getImportRowCount(job2.id);

      expect(job1Count).toBe(3);
      expect(job2Count).toBe(2);
    });
  });

  describe("Normalized Data Structure", () => {
    it("stores product-level materials in normalized data", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        materials: [
          { brandMaterialId: crypto.randomUUID(), percentage: "50" },
          { brandMaterialId: crypto.randomUUID(), percentage: "50" },
        ],
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { Materials: "Cotton;Polyester", Percentages: "50;50" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      const normalizedData = rows[0]?.normalized as NormalizedRowData;

      expect(normalizedData.materials).toHaveLength(2);
      expect(normalizedData.materials[0]?.percentage).toBe("50");
    });

    it("stores product-level environment data in normalized data", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        environment: {
          carbonKgCo2e: "5.5",
          waterLiters: "100",
        },
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Kilograms CO2": "5.5", "Liters Water Used": "100" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      const normalizedData = rows[0]?.normalized as NormalizedRowData;

      expect(normalizedData.environment).not.toBeNull();
      expect(normalizedData.environment?.carbonKgCo2e).toBe("5.5");
      expect(normalizedData.environment?.waterLiters).toBe("100");
    });

    it("stores variant-level attributes in normalized data", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      const normalized = createNormalizedRowData({
        variants: [
          {
            stagingId: crypto.randomUUID(),
            rowNumber: 4,
            action: "CREATE",
            existingVariantId: null,
            id: crypto.randomUUID(),
            productId: crypto.randomUUID(),
            upid: null,
            barcode: null,
            sku: "TEST-SKU-001",
            nameOverride: null,
            descriptionOverride: null,
            imagePathOverride: null,
            rowStatus: "PENDING",
            errors: [],
            attributes: [
              {
                attributeId: crypto.randomUUID(),
                attributeValueId: crypto.randomUUID(),
                sortOrder: 0,
              },
              {
                attributeId: crypto.randomUUID(),
                attributeValueId: crypto.randomUUID(),
                sortOrder: 1,
              },
            ],
            materials: [],
            ecoClaims: [],
            environment: null,
            journeySteps: [],
            weight: null,
            rawData: {},
          },
        ],
      });

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Attribute 1": "Size", "Attribute Value 1": "Large" },
        normalized,
        status: "PENDING",
      });

      const rows = await getImportRows(job.id);
      const normalizedData = rows[0]?.normalized as NormalizedRowData;

      expect(normalizedData.variants[0]?.attributes).toHaveLength(2);
    });
  });
});
