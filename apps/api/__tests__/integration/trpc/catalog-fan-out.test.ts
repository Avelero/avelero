/**
 * Integration Tests: Catalog Router Dirty Marking
 *
 * Verifies that catalog mutations mark affected published passports dirty
 * inline instead of queueing a background fan-out task.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it } from "bun:test";
import { createPassportForVariant } from "@v1/db/queries/products";
import * as schema from "@v1/db/schema";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";
import { eq, inArray } from "drizzle-orm";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { catalogRouter } from "../../../src/trpc/routers/catalog";

type PassportFixture = {
  productId: string;
  variantId: string;
  passportId: string;
};

type ProductStatus = "published" | "scheduled" | "unpublished";

/**
 * Build a stable short suffix for test record names.
 */
function randomSuffix(): string {
  // Keep handles and names unique across test cases.
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Create a mock authenticated tRPC context for catalog router calls.
 */
function createMockContext(options: {
  brandId: string;
  userEmail: string;
  userId: string;
}): AuthenticatedTRPCContext & { brandId: string } {
  // Provide the minimum authenticated shape needed by the router middleware.
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
    role: "owner",
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Create a brand membership for the test user.
 */
async function createBrandMembership(
  brandId: string,
  userId: string,
): Promise<void> {
  // Authorize the caller against the brand-scoped procedures.
  await testDb.insert(schema.brandMembers).values({
    brandId,
    userId,
    role: "owner",
  });
}

/**
 * Insert a product with an optional manufacturer link.
 */
async function createProduct(options: {
  brandId: string;
  manufacturerId?: string | null;
  name: string;
  status: ProductStatus;
}): Promise<string> {
  // Seed a product row that can participate in catalog dirty-marking lookups.
  const productId = crypto.randomUUID();

  await testDb.insert(schema.products).values({
    id: productId,
    brandId: options.brandId,
    manufacturerId: options.manufacturerId ?? null,
    name: options.name,
    productHandle: `product-${randomSuffix()}`,
    status: options.status,
  });

  return productId;
}

/**
 * Insert a variant for the supplied product.
 */
async function createVariant(productId: string): Promise<{
  id: string;
  upid: string;
  sku: string;
  barcode: string;
}> {
  // Create a variant row plus identifiers that can be copied onto the passport.
  const variantId = crypto.randomUUID();
  const upid = `UPID-${randomSuffix()}`;
  const sku = `SKU-${randomSuffix()}`;
  const barcode = `BARCODE-${randomSuffix()}`;

  await testDb.insert(schema.productVariants).values({
    id: variantId,
    productId,
    sku,
    barcode,
    upid,
  });

  return {
    id: variantId,
    upid,
    sku,
    barcode,
  };
}

/**
 * Create a product, variant, and passport fixture in one helper call.
 */
async function createPassportFixture(options: {
  brandId: string;
  manufacturerId?: string | null;
  name: string;
  status: ProductStatus;
}): Promise<PassportFixture> {
  // Keep the fixture setup concise for each catalog dirty-marking test.
  const productId = await createProduct(options);
  const variant = await createVariant(productId);
  const passport = await createPassportForVariant(
    testDb,
    variant.id,
    options.brandId,
    {
      upid: variant.upid,
      sku: variant.sku,
      barcode: variant.barcode,
    },
  );

  if (!passport) {
    throw new Error("Failed to create passport fixture");
  }

  return {
    productId,
    variantId: variant.id,
    passportId: passport.id,
  };
}

/**
 * Load dirty-flag state for a set of passports.
 */
async function listPassportDirtyStates(passportIds: string[]) {
  // Read the current dirty flags after a catalog mutation completes.
  return testDb
    .select({
      id: schema.productPassports.id,
      dirty: schema.productPassports.dirty,
    })
    .from(schema.productPassports)
    .where(inArray(schema.productPassports.id, passportIds));
}

describe("Catalog Router Dirty Marking", () => {
  let brandId: string;
  let userEmail: string;
  let userId: string;

  beforeEach(async () => {
    // Create a fresh brand-scoped caller for each test case.
    brandId = await createTestBrand("Catalog Dirty Router Brand");
    userEmail = `catalog-dirty-${randomSuffix()}@example.com`;
    userId = await createTestUser(userEmail);
    await createBrandMembership(brandId, userId);
  });

  it("marks published manufacturer-linked passports dirty when updating a manufacturer", async () => {
    // Update a manufacturer and ensure only published linked products are dirtied.
    const manufacturerId = crypto.randomUUID();
    await testDb.insert(schema.brandManufacturers).values({
      id: manufacturerId,
      brandId,
      name: `Manufacturer ${randomSuffix()}`,
    });

    const publishedFixture = await createPassportFixture({
      brandId,
      manufacturerId,
      name: "Published Manufacturer Product",
      status: "published",
    });
    const unpublishedFixture = await createPassportFixture({
      brandId,
      manufacturerId,
      name: "Unpublished Manufacturer Product",
      status: "unpublished",
    });

    const ctx = createMockContext({ brandId, userEmail, userId });
    await catalogRouter.createCaller(ctx).manufacturers.update({
      id: manufacturerId,
      name: `Updated Manufacturer ${randomSuffix()}`,
    });

    const dirtyRows = await listPassportDirtyStates([
      publishedFixture.passportId,
      unpublishedFixture.passportId,
    ]);

    expect(
      dirtyRows.find((row) => row.id === publishedFixture.passportId)?.dirty,
    ).toBe(true);
    expect(
      dirtyRows.find((row) => row.id === unpublishedFixture.passportId)?.dirty,
    ).toBe(false);
  });

  it("captures affected published products before deleting a manufacturer", async () => {
    // Delete a manufacturer after linking it to both published and unpublished products.
    const manufacturerId = crypto.randomUUID();
    await testDb.insert(schema.brandManufacturers).values({
      id: manufacturerId,
      brandId,
      name: `Manufacturer ${randomSuffix()}`,
    });

    const publishedFixture = await createPassportFixture({
      brandId,
      manufacturerId,
      name: "Published Manufacturer Product",
      status: "published",
    });
    const unpublishedFixture = await createPassportFixture({
      brandId,
      manufacturerId,
      name: "Unpublished Manufacturer Product",
      status: "unpublished",
    });

    const ctx = createMockContext({ brandId, userEmail, userId });
    await catalogRouter.createCaller(ctx).manufacturers.delete({
      id: manufacturerId,
    });

    const dirtyRows = await listPassportDirtyStates([
      publishedFixture.passportId,
      unpublishedFixture.passportId,
    ]);

    expect(
      dirtyRows.find((row) => row.id === publishedFixture.passportId)?.dirty,
    ).toBe(true);
    expect(
      dirtyRows.find((row) => row.id === unpublishedFixture.passportId)?.dirty,
    ).toBe(false);

    const [publishedProduct] = await testDb
      .select({ manufacturerId: schema.products.manufacturerId })
      .from(schema.products)
      .where(eq(schema.products.id, publishedFixture.productId));

    expect(publishedProduct?.manufacturerId).toBeNull();
  });

  it("captures published product and variant material references before deleting a certification", async () => {
    // Delete a certification after linking it through both product and variant materials.
    const certificationId = crypto.randomUUID();
    const productMaterialId = crypto.randomUUID();
    const variantMaterialId = crypto.randomUUID();

    await testDb.insert(schema.brandCertifications).values({
      id: certificationId,
      brandId,
      title: `Certification ${randomSuffix()}`,
    });

    await testDb.insert(schema.brandMaterials).values([
      {
        id: productMaterialId,
        brandId,
        name: `Product Material ${randomSuffix()}`,
        certificationId,
      },
      {
        id: variantMaterialId,
        brandId,
        name: `Variant Material ${randomSuffix()}`,
        certificationId,
      },
    ]);

    const productLinkedFixture = await createPassportFixture({
      brandId,
      name: "Published Product Material Product",
      status: "published",
    });
    const variantLinkedFixture = await createPassportFixture({
      brandId,
      name: "Published Variant Material Product",
      status: "published",
    });
    const unpublishedFixture = await createPassportFixture({
      brandId,
      name: "Unpublished Certification Product",
      status: "unpublished",
    });

    await testDb.insert(schema.productMaterials).values([
      {
        productId: productLinkedFixture.productId,
        brandMaterialId: productMaterialId,
      },
      {
        productId: unpublishedFixture.productId,
        brandMaterialId: productMaterialId,
      },
    ]);

    await testDb.insert(schema.variantMaterials).values({
      variantId: variantLinkedFixture.variantId,
      brandMaterialId: variantMaterialId,
    });

    const ctx = createMockContext({ brandId, userEmail, userId });
    await catalogRouter.createCaller(ctx).certifications.delete({
      id: certificationId,
    });

    const dirtyRows = await listPassportDirtyStates([
      productLinkedFixture.passportId,
      variantLinkedFixture.passportId,
      unpublishedFixture.passportId,
    ]);

    expect(
      dirtyRows.find((row) => row.id === productLinkedFixture.passportId)?.dirty,
    ).toBe(true);
    expect(
      dirtyRows.find((row) => row.id === variantLinkedFixture.passportId)?.dirty,
    ).toBe(true);
    expect(
      dirtyRows.find((row) => row.id === unpublishedFixture.passportId)?.dirty,
    ).toBe(false);

    const materials = await testDb
      .select({
        certificationId: schema.brandMaterials.certificationId,
        id: schema.brandMaterials.id,
      })
      .from(schema.brandMaterials)
      .where(
        inArray(schema.brandMaterials.id, [productMaterialId, variantMaterialId]),
      );

    expect(materials).toEqual(
      expect.arrayContaining([
        { id: productMaterialId, certificationId: null },
        { id: variantMaterialId, certificationId: null },
      ]),
    );
  });
});
