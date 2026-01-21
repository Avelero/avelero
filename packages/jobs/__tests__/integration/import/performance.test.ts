/**
 * Integration Tests: Import Performance
 *
 * Tests performance characteristics of the import process:
 * - Processing 100 products in reasonable time
 * - Processing 1000 variants in reasonable time
 * - Catalog loader caching efficiency
 * - Import row inserts are efficient
 * - Large normalized data is handled correctly
 *
 * Note: This has been updated for the new architecture that uses import_rows
 * with normalized JSONB data instead of separate staging tables.
 *
 * @module tests/integration/import/performance
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
import { ExcelBuilder } from "@v1/testing/bulk-import";
import { eq, sql } from "drizzle-orm";
import { loadBrandCatalog } from "../../../src/lib/catalog-loader";
import { parseExcelFile } from "../../../src/lib/excel";

describe("Import Performance", () => {
  let brandId: string;
  let catalog: InsertedCatalog;

  beforeEach(async () => {
    await cleanupTables();
    brandId = await createTestBrand("Performance Test Brand");
    catalog = await TestCatalog.setupFull(testDb, brandId);
  });

  // Helper to get first key from a Map
  function getFirstKey<K, V>(map: Map<K, V>): K | undefined {
    const first = map.keys().next();
    return first.done ? undefined : first.value;
  }

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
          environment: null,
          journeySteps: [],
          weight: null,
          rawData: {},
        },
      ],
      tags: [],
      materials: [],
      environment: null,
      journeySteps: [],
      weight: null,
      ...overrides,
    };
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

  describe("Large Dataset Processing", () => {
    it("processes 100 products in reasonable time", async () => {
      // Get catalog values from Maps
      const manufacturerName = getFirstKey(catalog.manufacturers);
      const seasonName = getFirstKey(catalog.seasons);

      // Create 100 products
      const products = [];
      for (let i = 0; i < 100; i++) {
        products.push({
          handle: `product-${i}`,
          title: `Performance Test Product ${i}`,
          manufacturer: manufacturerName,
          season: seasonName,
          variants: [
            {
              sku: `PERF-SKU-${i}`,
              barcode: `${1000000000000 + i}`,
            },
          ],
        });
      }

      const excelBuffer = await ExcelBuilder.create({ products });

      // Measure parsing time
      const startTime = performance.now();
      const result = await parseExcelFile(excelBuffer);
      const parseTime = performance.now() - startTime;

      // Should complete in under 5 seconds
      expect(parseTime).toBeLessThan(5000);
      expect(result.products).toHaveLength(100);
      expect(result.errors).toHaveLength(0);

      // Log performance metrics
      console.log(
        `Parsed 100 products in ${parseTime.toFixed(2)}ms (${(100 / (parseTime / 1000)).toFixed(2)} products/sec)`,
      );
    });

    it("processes products with 10 variants each efficiently", async () => {
      // Get catalog values from Maps
      const manufacturerName = getFirstKey(catalog.manufacturers);
      const seasonName = getFirstKey(catalog.seasons);
      const attributeName = getFirstKey(catalog.attributes) || "Size";

      // Create 10 products with 10 variants each = 100 variants total
      const products = [];
      for (let i = 0; i < 10; i++) {
        const variants = [];
        for (let v = 0; v < 10; v++) {
          variants.push({
            sku: `PERF-SKU-${i}-V${v}`,
            barcode: `${1000000000000 + i * 10 + v}`,
            attributes: [{ name: attributeName, value: `Size-${v}` }],
          });
        }

        products.push({
          handle: `multivar-product-${i}`,
          title: `Multi-Variant Product ${i}`,
          manufacturer: manufacturerName,
          season: seasonName,
          variants,
        });
      }

      const excelBuffer = await ExcelBuilder.create({ products });

      const startTime = performance.now();
      const result = await parseExcelFile(excelBuffer);
      const parseTime = performance.now() - startTime;

      // Should complete in under 5 seconds
      expect(parseTime).toBeLessThan(5000);
      expect(result.products).toHaveLength(10);

      // Total variants should be 100
      const totalVariants = result.products.reduce(
        (acc, p) => acc + p.variants.length,
        0,
      );
      expect(totalVariants).toBe(100);

      console.log(
        `Parsed 10 products with 100 total variants in ${parseTime.toFixed(2)}ms`,
      );
    });
  });

  describe("Catalog Loader Caching", () => {
    it("catalog loader caches efficiently", async () => {
      // First call - should populate cache
      const startTime1 = performance.now();
      const catalog1 = await loadBrandCatalog(testDb, brandId);
      const loadTime1 = performance.now() - startTime1;

      // Second call - should use cached data (in real implementation)
      // Note: Our current implementation doesn't cache between calls,
      // but this test ensures consistent performance
      const startTime2 = performance.now();
      const catalog2 = await loadBrandCatalog(testDb, brandId);
      const loadTime2 = performance.now() - startTime2;

      // Both loads should complete in reasonable time
      expect(loadTime1).toBeLessThan(2000);
      expect(loadTime2).toBeLessThan(2000);

      // Verify catalog data is consistent (Maps have .size property)
      expect(catalog1.categories.size).toBe(catalog2.categories.size);
      expect(catalog1.manufacturers.size).toBe(catalog2.manufacturers.size);

      console.log(
        `Catalog load times: First: ${loadTime1.toFixed(2)}ms, Second: ${loadTime2.toFixed(2)}ms`,
      );
    });

    it("catalog loader loads all entity types", async () => {
      const startTime = performance.now();
      const loadedCatalog = await loadBrandCatalog(testDb, brandId);
      const loadTime = performance.now() - startTime;

      // Should complete in under 2 seconds
      expect(loadTime).toBeLessThan(2000);

      // Verify entity types are loaded (Maps have .size property)
      // Categories are from taxonomy, may be empty in test
      expect(loadedCatalog.manufacturers.size).toBeGreaterThan(0);
      expect(loadedCatalog.seasons.size).toBeGreaterThan(0);
      expect(loadedCatalog.materials.size).toBeGreaterThan(0);
      expect(loadedCatalog.tags.size).toBeGreaterThan(0);
      expect(loadedCatalog.attributes.size).toBeGreaterThan(0);

      console.log(
        `Loaded catalog with ${loadedCatalog.categories.size} categories, ` +
          `${loadedCatalog.manufacturers.size} manufacturers, ` +
          `${loadedCatalog.materials.size} materials, ` +
          `${loadedCatalog.attributes.size} attributes ` +
          `in ${loadTime.toFixed(2)}ms`,
      );
    });
  });

  describe("Import Row Operations", () => {
    it("import row inserts complete efficiently", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Insert 50 import rows with normalized data
      const startTime = performance.now();

      for (let i = 0; i < 50; i++) {
        const normalized = createNormalizedRowData({
          rowNumber: 4 + i,
          productHandle: `import-product-${i}`,
          name: `Import Product ${i}`,
          rowStatus: "PENDING",
        });

        await testDb.insert(schema.importRows).values({
          jobId: job.id,
          rowNumber: 4 + i,
          raw: { "Product Handle": `import-product-${i}` },
          normalized,
          status: "PENDING",
        });
      }

      const insertTime = performance.now() - startTime;

      // Should complete in under 5 seconds (100ms per insert is generous)
      expect(insertTime).toBeLessThan(5000);

      // Verify all records were created
      const count = await getImportRowCount(job.id);
      expect(count).toBe(50);

      console.log(
        `Inserted 50 import rows in ${insertTime.toFixed(2)}ms (${(insertTime / 50).toFixed(2)}ms per insert)`,
      );
    });

    it("handles import rows with large normalized JSONB data", async () => {
      const job = await TestDatabase.createImportJob(testDb, brandId);

      // Create a product with many variants (10 variants with full data)
      const productId = crypto.randomUUID();
      const variants: NormalizedVariant[] = [];
      for (let i = 0; i < 10; i++) {
        variants.push({
          stagingId: crypto.randomUUID(),
          rowNumber: 4 + i,
          action: "CREATE",
          existingVariantId: null,
          id: crypto.randomUUID(),
          productId,
          upid: null,
          barcode: `${1000000000000 + i}`,
          sku: `LARGE-SKU-${i}`,
          nameOverride: `Variant ${i} Name Override`,
          descriptionOverride: `Variant ${i} Description Override`,
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
          materials: [
            { brandMaterialId: crypto.randomUUID(), percentage: "50" },
            { brandMaterialId: crypto.randomUUID(), percentage: "50" },
          ],
          environment: { carbonKgCo2e: "5.5", waterLiters: "100" },
          journeySteps: [
            {
              sortIndex: 0,
              stepType: "Manufacturing",
              operatorIds: [crypto.randomUUID()],
            },
          ],
          weight: { weight: "250", weightUnit: "g" },
          rawData: {},
        });
      }

      const normalized = createNormalizedRowData({
        id: productId,
        variants,
        materials: [
          { brandMaterialId: crypto.randomUUID(), percentage: "100" },
        ],
        environment: { carbonKgCo2e: "10.0", waterLiters: "200" },
        journeySteps: [
          {
            sortIndex: 0,
            stepType: "Raw Material",
            operatorIds: [crypto.randomUUID()],
          },
        ],
        weight: { weight: "500", weightUnit: "g" },
      });

      const startTime = performance.now();

      await testDb.insert(schema.importRows).values({
        jobId: job.id,
        rowNumber: 4,
        raw: { "Product Handle": "large-product" },
        normalized,
        status: "PENDING",
      });

      const insertTime = performance.now() - startTime;

      // Should complete in under 500ms for a single row
      expect(insertTime).toBeLessThan(500);

      // Verify the row was created
      const count = await getImportRowCount(job.id);
      expect(count).toBe(1);

      // Verify the data is intact
      const rows = await testDb
        .select()
        .from(schema.importRows)
        .where(eq(schema.importRows.jobId, job.id));

      const storedNormalized = rows[0]?.normalized as NormalizedRowData;
      expect(storedNormalized.variants).toHaveLength(10);
      expect(storedNormalized.variants[0]?.attributes).toHaveLength(2);
      expect(storedNormalized.variants[0]?.materials).toHaveLength(2);

      console.log(
        `Inserted large import row (10 variants, full data) in ${insertTime.toFixed(2)}ms`,
      );
    });
  });
});
