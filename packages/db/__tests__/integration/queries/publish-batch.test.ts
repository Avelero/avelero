/**
 * Integration Tests: Set-Based Batch Publish
 *
 * Verifies the set-based publish pipeline used by bulk commit workflows:
 * - Only products in "published" status are processed
 * - Unchanged content reuses the current version (hash dedupe)
 * - Changed content creates a new immutable version
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { desc, eq } from "drizzle-orm";
import { publishProductsSetBased } from "@v1/db/queries/products";
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
 * Create a product with one variant for publish testing.
 */
async function createProductWithVariant(input: {
  brandId: string;
  status: "published" | "unpublished" | "scheduled";
  name: string;
  upid?: string;
}) {
  // Create the product in the requested status.
  const productId = crypto.randomUUID();
  await testDb.insert(schema.products).values({
    id: productId,
    brandId: input.brandId,
    name: input.name,
    productHandle: `product-${randomSuffix()}`,
    status: input.status,
  });

  // Create one variant tied to this product.
  const variantId = crypto.randomUUID();
  await testDb.insert(schema.productVariants).values({
    id: variantId,
    productId,
    upid: input.upid ?? `UPID-${randomSuffix()}`,
    sku: `SKU-${randomSuffix()}`,
    barcode: `${Math.floor(1_000_000_000_000 + Math.random() * 9_000_000_000_000)}`,
  });

  return { productId, variantId };
}

/**
 * Load a passport row by working variant ID.
 */
async function getPassportByVariantId(variantId: string) {
  // Query the passport linked to the given variant.
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
  // Query immutable versions for assertion checks.
  return testDb
    .select({
      id: schema.productPassportVersions.id,
      versionNumber: schema.productPassportVersions.versionNumber,
    })
    .from(schema.productPassportVersions)
    .where(eq(schema.productPassportVersions.passportId, passportId))
    .orderBy(desc(schema.productPassportVersions.versionNumber));
}

describe("Set-Based Batch Publish", () => {
  let brandId: string;

  beforeEach(async () => {
    // Reset test data between cases.
    await cleanupTables();
    brandId = await createTestBrand("Batch Publish Brand");
  });

  it("publishes only products whose status is published", async () => {
    // Create one published and one unpublished product.
    const published = await createProductWithVariant({
      brandId,
      status: "published",
      name: "Published Product",
    });
    const unpublished = await createProductWithVariant({
      brandId,
      status: "unpublished",
      name: "Unpublished Product",
    });

    const result = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [published.productId, unpublished.productId],
      variantChunkSize: 10,
    });

    // Only the published product should be processed.
    expect(result.totalProductsRequested).toBe(2);
    expect(result.totalProductsPublishedStatus).toBe(1);
    expect(result.versionsCreated).toBe(1);

    const publishedPassport = await getPassportByVariantId(published.variantId);
    const unpublishedPassport = await getPassportByVariantId(
      unpublished.variantId,
    );

    expect(publishedPassport).not.toBeNull();
    expect(publishedPassport?.currentVersionId).toBeTruthy();
    expect(unpublishedPassport).toBeNull();
  });

  it("skips creating a new version when snapshot content is unchanged", async () => {
    // Create a published product and run publish twice without changes.
    const seeded = await createProductWithVariant({
      brandId,
      status: "published",
      name: "Stable Product",
    });

    const firstResult = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });
    expect(firstResult.versionsCreated).toBe(1);

    const secondResult = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });
    expect(secondResult.versionsCreated).toBe(0);
    expect(secondResult.versionsSkippedUnchanged).toBe(1);

    const passport = await getPassportByVariantId(seeded.variantId);
    expect(passport).not.toBeNull();
    const versions = await getVersionsForPassport(passport!.id);
    expect(versions).toHaveLength(1);
    expect(versions[0]?.versionNumber).toBe(1);
  });

  it("creates a new version when snapshot content changes", async () => {
    // Create and publish once, then modify source data and publish again.
    const seeded = await createProductWithVariant({
      brandId,
      status: "published",
      name: "Versioned Product",
    });

    const firstResult = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });
    expect(firstResult.versionsCreated).toBe(1);

    // Change a snapshot-relevant field.
    await testDb
      .update(schema.products)
      .set({ name: "Versioned Product Updated" })
      .where(eq(schema.products.id, seeded.productId));

    const secondResult = await publishProductsSetBased(testDb, {
      brandId,
      productIds: [seeded.productId],
      variantChunkSize: 10,
    });
    expect(secondResult.versionsCreated).toBe(1);
    expect(secondResult.versionsSkippedUnchanged).toBe(0);

    const passport = await getPassportByVariantId(seeded.variantId);
    expect(passport).not.toBeNull();

    const versions = await getVersionsForPassport(passport!.id);
    expect(versions).toHaveLength(2);
    expect(versions[0]?.versionNumber).toBe(2);
    expect(versions[1]?.versionNumber).toBe(1);
    expect(passport?.currentVersionId).toBe(versions[0]?.id);
  });
});
