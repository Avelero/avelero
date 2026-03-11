/**
 * Integration Tests: Passport Dirty Infrastructure
 *
 * Verifies the phase 1 passport dirty-flag primitives:
 * - passport creation starts clean with no firstPublishedAt value
 * - dirty marking respects published product status
 * - dirty clearing resets selected passports only
 */

import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import {
  batchClearDirtyFlags,
  batchCreatePassportsForVariants,
  clearDirtyFlag,
  createPassportForVariant,
  createProductPassport,
  markAllBrandPassportsDirty,
  markPassportsDirtyByProductIds,
  markPassportsDirtyByVariantIds,
} from "@v1/db/queries/products";
import * as schema from "@v1/db/schema";
import {
  cleanupTables,
  createTestBrand,
  createTestProduct,
  createTestVariant,
  testDb,
} from "@v1/db/testing";
import { eq, inArray } from "drizzle-orm";

/**
 * Create a product, variant, and passport fixture for dirty-flag tests.
 */
async function createPassportFixture(
  brandId: string,
  status: "published" | "unpublished",
  options: {
    upid: string;
    sku?: string | null;
    barcode?: string | null;
  },
) {
  // Create a product/variant pair so the passport can link back to working data.
  const product = await createTestProduct(brandId, {
    status,
    productHandle: `passport-dirty-${Math.random().toString(36).slice(2, 8)}`,
  });
  const variant = await createTestVariant(product.id, {
    upid: options.upid,
    sku: options.sku ?? undefined,
    barcode: options.barcode ?? null,
  });
  const passport = requireValue(
    await createPassportForVariant(testDb, variant.id, brandId, {
      upid: variant.upid!,
      sku: variant.sku,
      barcode: variant.barcode,
    }),
    "Failed to create passport fixture",
  );

  return { product, variant, passport };
}

/**
 * Assert that a test setup helper returned a value.
 */
function requireValue<T>(value: T | undefined, message: string): T {
  // Fail fast so setup issues are surfaced as test errors instead of type noise.
  if (value === undefined) {
    throw new Error(message);
  }

  return value;
}

describe("Passport dirty infrastructure", () => {
  beforeEach(async () => {
    // Reset the mutable tables so each test starts from a known baseline.
    await cleanupTables();
  });

  it("creates passports with null firstPublishedAt and dirty=false", async () => {
    const brandId = await createTestBrand("Dirty Infra Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      productHandle: `passport-creation-${Math.random().toString(36).slice(2, 8)}`,
    });

    const variantA = await createTestVariant(product.id, {
      upid: `DIRTYA${Math.random().toString(36).slice(2, 10)}`,
      sku: "SKU-A",
      barcode: "1111111111111",
    });
    const variantB = await createTestVariant(product.id, {
      upid: `DIRTYB${Math.random().toString(36).slice(2, 10)}`,
      sku: "SKU-B",
      barcode: "2222222222222",
    });
    const variantC = await createTestVariant(product.id, {
      upid: `DIRTYC${Math.random().toString(36).slice(2, 10)}`,
      sku: "SKU-C",
      barcode: "3333333333333",
    });
    const variantD = await createTestVariant(product.id, {
      upid: `DIRTYD${Math.random().toString(36).slice(2, 10)}`,
      sku: "SKU-D",
      barcode: "4444444444444",
    });

    const passportA = requireValue(
      await createProductPassport(testDb, variantA.id, brandId),
      "Failed to create passport A",
    );
    const passportB = requireValue(
      await createPassportForVariant(testDb, variantB.id, brandId, {
        upid: variantB.upid!,
        sku: variantB.sku,
        barcode: variantB.barcode,
      }),
      "Failed to create passport B",
    );
    const passportsCAndD = await batchCreatePassportsForVariants(
      testDb,
      brandId,
      [
        {
          variantId: variantC.id,
          upid: variantC.upid!,
          sku: variantC.sku,
          barcode: variantC.barcode,
        },
        {
          variantId: variantD.id,
          upid: variantD.upid!,
          sku: variantD.sku,
          barcode: variantD.barcode,
        },
      ],
    );

    const createdPassportIds = [
      passportA.id,
      passportB.id,
      ...passportsCAndD.map((passport) => passport.id),
    ];
    const rows = await testDb
      .select({
        id: schema.productPassports.id,
        dirty: schema.productPassports.dirty,
        firstPublishedAt: schema.productPassports.firstPublishedAt,
      })
      .from(schema.productPassports)
      .where(inArray(schema.productPassports.id, createdPassportIds));

    expect(rows).toHaveLength(4);
    expect(rows.every((row) => row.dirty === false)).toBe(true);
    expect(rows.every((row) => row.firstPublishedAt === null)).toBe(true);
  });

  it("marks only published passports dirty when targeting variant IDs", async () => {
    const brandId = await createTestBrand("Variant Dirty Brand");
    const publishedFixture = await createPassportFixture(brandId, "published", {
      upid: `PUBVAR${Math.random().toString(36).slice(2, 10)}`,
    });
    const unpublishedFixture = await createPassportFixture(
      brandId,
      "unpublished",
      {
        upid: `UNPUBVAR${Math.random().toString(36).slice(2, 10)}`,
      },
    );

    const result = await markPassportsDirtyByVariantIds(testDb, [
      publishedFixture.variant.id,
      unpublishedFixture.variant.id,
    ]);
    const rows = await testDb
      .select({
        id: schema.productPassports.id,
        dirty: schema.productPassports.dirty,
      })
      .from(schema.productPassports)
      .where(
        inArray(schema.productPassports.id, [
          publishedFixture.passport.id,
          unpublishedFixture.passport.id,
        ]),
      );

    expect(result.marked).toBe(1);
    expect(result.passportIds).toEqual([publishedFixture.passport.id]);
    expect(
      rows.find((row) => row.id === publishedFixture.passport.id)?.dirty,
    ).toBe(true);
    expect(
      rows.find((row) => row.id === unpublishedFixture.passport.id)?.dirty,
    ).toBe(false);
  });

  it("creates and dirties missing passports for published product targets", async () => {
    const brandId = await createTestBrand("Ensure Dirty Brand");
    const product = await createTestProduct(brandId, {
      status: "published",
      productHandle: `ensure-dirty-${Math.random().toString(36).slice(2, 8)}`,
    });
    const variant = await createTestVariant(product.id, {
      upid: `ENSURE${Math.random().toString(36).slice(2, 10)}`,
      sku: "ENSURE-SKU",
      barcode: "5555555555555",
    });

    const marked = await markPassportsDirtyByProductIds(testDb, brandId, [
      product.id,
    ]);
    const [passport] = await testDb
      .select({
        id: schema.productPassports.id,
        workingVariantId: schema.productPassports.workingVariantId,
        dirty: schema.productPassports.dirty,
      })
      .from(schema.productPassports)
      .where(eq(schema.productPassports.workingVariantId, variant.id))
      .limit(1);

    expect(passport?.workingVariantId).toBe(variant.id);
    expect(passport?.dirty).toBe(true);
    expect(marked.marked).toBe(1);
    expect(marked.passportIds).toEqual(passport ? [passport.id] : []);
  });

  it("marks product passports dirty and clears them again", async () => {
    const brandId = await createTestBrand("Product Dirty Brand");
    const publishedProduct = await createTestProduct(brandId, {
      status: "published",
      productHandle: `dirty-product-${Math.random().toString(36).slice(2, 8)}`,
    });
    const unpublishedProduct = await createTestProduct(brandId, {
      status: "unpublished",
      productHandle: `clean-product-${Math.random().toString(36).slice(2, 8)}`,
    });

    const publishedVariantA = await createTestVariant(publishedProduct.id, {
      upid: `PRODPA${Math.random().toString(36).slice(2, 10)}`,
    });
    const publishedVariantB = await createTestVariant(publishedProduct.id, {
      upid: `PRODPB${Math.random().toString(36).slice(2, 10)}`,
    });
    const unpublishedVariant = await createTestVariant(unpublishedProduct.id, {
      upid: `PRODPC${Math.random().toString(36).slice(2, 10)}`,
    });

    const publishedPassportA = requireValue(
      await createPassportForVariant(testDb, publishedVariantA.id, brandId, {
        upid: publishedVariantA.upid!,
      }),
      "Failed to create published passport A",
    );
    const publishedPassportB = requireValue(
      await createPassportForVariant(testDb, publishedVariantB.id, brandId, {
        upid: publishedVariantB.upid!,
      }),
      "Failed to create published passport B",
    );
    const unpublishedPassport = requireValue(
      await createPassportForVariant(testDb, unpublishedVariant.id, brandId, {
        upid: unpublishedVariant.upid!,
      }),
      "Failed to create unpublished passport",
    );

    const marked = await markPassportsDirtyByProductIds(testDb, brandId, [
      publishedProduct.id,
      unpublishedProduct.id,
    ]);

    expect(marked.marked).toBe(2);
    expect(marked.passportIds.sort()).toEqual(
      [publishedPassportA.id, publishedPassportB.id].sort(),
    );

    const clearedSingle = await clearDirtyFlag(testDb, publishedPassportA.id);
    const clearedBatch = await batchClearDirtyFlags(testDb, [
      publishedPassportB.id,
      unpublishedPassport.id,
    ]);
    const rows = await testDb
      .select({
        id: schema.productPassports.id,
        dirty: schema.productPassports.dirty,
      })
      .from(schema.productPassports)
      .where(
        inArray(schema.productPassports.id, [
          publishedPassportA.id,
          publishedPassportB.id,
          unpublishedPassport.id,
        ]),
      );

    expect(clearedSingle?.id).toBe(publishedPassportA.id);
    expect(clearedBatch.cleared).toBe(1);
    expect(rows.every((row) => row.dirty === false)).toBe(true);
  });

  it("marks only the selected brand's published passports dirty", async () => {
    const brandAId = await createTestBrand("Brand A Dirty");
    const brandBId = await createTestBrand("Brand B Dirty");

    const brandAPublished = await createPassportFixture(brandAId, "published", {
      upid: `BRANDA${Math.random().toString(36).slice(2, 10)}`,
    });
    const brandAUnpublished = await createPassportFixture(
      brandAId,
      "unpublished",
      {
        upid: `BRANDAU${Math.random().toString(36).slice(2, 10)}`,
      },
    );
    const brandBPublished = await createPassportFixture(brandBId, "published", {
      upid: `BRANDB${Math.random().toString(36).slice(2, 10)}`,
    });

    const marked = await markAllBrandPassportsDirty(testDb, brandAId);
    const rows = await testDb
      .select({
        id: schema.productPassports.id,
        dirty: schema.productPassports.dirty,
      })
      .from(schema.productPassports)
      .where(
        inArray(schema.productPassports.id, [
          brandAPublished.passport.id,
          brandAUnpublished.passport.id,
          brandBPublished.passport.id,
        ]),
      );

    expect(marked.marked).toBe(1);
    expect(marked.passportIds).toEqual([brandAPublished.passport.id]);
    expect(
      rows.find((row) => row.id === brandAPublished.passport.id)?.dirty,
    ).toBe(true);
    expect(
      rows.find((row) => row.id === brandAUnpublished.passport.id)?.dirty,
    ).toBe(false);
    expect(
      rows.find((row) => row.id === brandBPublished.passport.id)?.dirty,
    ).toBe(false);
  });
});
