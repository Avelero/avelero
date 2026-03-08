/**
 * Integration Tests: DPP Version Compression
 *
 * Verifies the phase 4 historical version compression flow:
 * - only superseded versions are compressed
 * - current versions remain readable as JSONB
 * - historical reads transparently decompress compressed snapshots
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { desc, eq } from "drizzle-orm";
import { getPublicDppVersion } from "@v1/db/queries/dpp";
import {
  batchCompressSupersededVersions,
  decompressVersion,
  publishProductsSetBased,
} from "@v1/db/queries/products";
import * as schema from "@v1/db/schema";
import { cleanupTables, createTestBrand, testDb } from "@v1/db/testing";

/**
 * Build a stable random suffix for test identifiers.
 */
function randomSuffix(): string {
  // Generate a short alphanumeric suffix.
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Create a published product with one variant for version compression tests.
 */
async function createPublishedProductWithVariant(input: {
  brandId: string;
  name: string;
  upid?: string;
}) {
  // Seed a published product so the set-based projector can materialize versions.
  const productId = crypto.randomUUID();
  await testDb.insert(schema.products).values({
    id: productId,
    brandId: input.brandId,
    name: input.name,
    productHandle: `product-${randomSuffix()}`,
    status: "published",
  });

  const variantId = crypto.randomUUID();
  const upid = input.upid ?? `UPID-${randomSuffix()}`;
  await testDb.insert(schema.productVariants).values({
    id: variantId,
    productId,
    upid,
    sku: `SKU-${randomSuffix()}`,
    barcode: `${Math.floor(1_000_000_000_000 + Math.random() * 9_000_000_000_000)}`,
  });

  return { productId, variantId, upid };
}

/**
 * Load the passport row linked to a variant.
 */
async function getPassportByVariantId(variantId: string) {
  // Query the passport created for the test variant.
  const [passport] = await testDb
    .select({
      id: schema.productPassports.id,
      currentVersionId: schema.productPassports.currentVersionId,
    })
    .from(schema.productPassports)
    .where(eq(schema.productPassports.workingVariantId, variantId))
    .limit(1);

  return passport ?? null;
}

/**
 * Load all versions for a passport, newest first.
 */
async function getVersionsForPassport(passportId: string) {
  // Query both JSON and compressed columns for assertions.
  return testDb
    .select({
      id: schema.productPassportVersions.id,
      versionNumber: schema.productPassportVersions.versionNumber,
      dataSnapshot: schema.productPassportVersions.dataSnapshot,
      compressedSnapshot: schema.productPassportVersions.compressedSnapshot,
      compressedAt: schema.productPassportVersions.compressedAt,
    })
    .from(schema.productPassportVersions)
    .where(eq(schema.productPassportVersions.passportId, passportId))
    .orderBy(desc(schema.productPassportVersions.versionNumber));
}

describe("DPP Version Compression", () => {
  let brandId: string;

  beforeEach(async () => {
    // Reset test data between cases.
    await cleanupTables();
    brandId = await createTestBrand("DPP Version Compression Brand");
  });

  it("compresses superseded versions while leaving the current version uncompressed", async () => {
    // Publish twice so the first version becomes compressible history.
    const seeded = await createPublishedProductWithVariant({
      brandId,
      name: "Compression Product",
      upid: "CMPRESS000000001",
    });

    await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });

    await testDb
      .update(schema.products)
      .set({ name: "Compression Product Updated" })
      .where(eq(schema.products.id, seeded.productId));

    await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });

    const passport = await getPassportByVariantId(seeded.variantId);
    expect(passport).not.toBeNull();

    const compression = await batchCompressSupersededVersions(testDb, {
      limit: 10,
    });
    expect(compression.scanned).toBe(1);
    expect(compression.compressed).toBe(1);
    expect(compression.skipped).toBe(0);

    const versions = await getVersionsForPassport(passport!.id);
    expect(versions).toHaveLength(2);

    const currentVersion = versions.find(
      (version) => version.versionNumber === 2,
    );
    const historicalVersion = versions.find(
      (version) => version.versionNumber === 1,
    );

    expect(currentVersion?.dataSnapshot).not.toBeNull();
    expect(currentVersion?.compressedSnapshot).toBeNull();
    expect(historicalVersion?.dataSnapshot).toBeNull();
    expect(historicalVersion?.compressedSnapshot).not.toBeNull();
    expect(historicalVersion?.compressedAt).toBeTruthy();

    const decompressed = await decompressVersion(testDb, historicalVersion!.id);
    expect(decompressed?.productAttributes.name).toBe("Compression Product");
  });

  it("returns a decompressed snapshot when reading a historical public version", async () => {
    // Compress an old version, then read it back through the public query path.
    const seeded = await createPublishedProductWithVariant({
      brandId,
      name: "Historical Public Product",
      upid: "CMPRESS000000002",
    });

    await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });

    await testDb
      .update(schema.products)
      .set({ name: "Historical Public Product Updated" })
      .where(eq(schema.products.id, seeded.productId));

    await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });

    const passport = await getPassportByVariantId(seeded.variantId);
    expect(passport).not.toBeNull();

    await batchCompressSupersededVersions(testDb, { limit: 10 });

    const historical = await getPublicDppVersion(testDb, seeded.upid, 1);
    expect(historical.found).toBe(true);
    expect(historical.snapshot?.productAttributes.name).toBe(
      "Historical Public Product",
    );
    expect(historical.version?.versionNumber).toBe(1);
  });
});
