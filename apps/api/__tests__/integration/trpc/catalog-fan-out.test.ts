/**
 * Integration Tests: Catalog Router Fan-Out
 *
 * Verifies that catalog deletes enqueue background fan-out jobs with the
 * affected published product IDs captured before destructive FK updates.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { beforeEach, describe, expect, it, mock } from "bun:test";
import * as schema from "@v1/db/schema";
import { createTestBrand, createTestUser, testDb } from "@v1/db/testing";
import { eq } from "drizzle-orm";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";

type TriggerCall = {
  id: string;
  payload: {
    brandId: string;
    entityType: string;
    entityId: string;
    productIds?: string[];
  };
  options?: {
    concurrencyKey?: string;
    delay?: string;
  };
};

const triggerCalls: TriggerCall[] = [];

const triggerMock = mock(
  async (
    id: string,
    payload: TriggerCall["payload"],
    options?: TriggerCall["options"],
  ) => {
    triggerCalls.push({ id, payload, options });
    return { id: `run_${triggerCalls.length}` } as const;
  },
);

mock.module("@trigger.dev/sdk/v3", () => ({
  tasks: {
    trigger: triggerMock,
  },
}));

import { catalogRouter } from "../../../src/trpc/routers/catalog";

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
  status: "published" | "scheduled" | "unpublished";
}): Promise<string> {
  // Seed a product row that can participate in catalog fan-out lookups.
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
async function createVariant(productId: string): Promise<string> {
  // Create a variant row for variant-level material fan-out paths.
  const variantId = crypto.randomUUID();

  await testDb.insert(schema.productVariants).values({
    id: variantId,
    productId,
    sku: `SKU-${randomSuffix()}`,
    upid: `UPID-${randomSuffix()}`,
  });

  return variantId;
}

describe("Catalog Router Fan-Out", () => {
  let brandId: string;
  let userEmail: string;
  let userId: string;

  beforeEach(async () => {
    // Reset the queued trigger calls for each test case.
    triggerCalls.length = 0;

    brandId = await createTestBrand("Catalog Fan-Out Router Brand");
    userEmail = `catalog-fan-out-${randomSuffix()}@example.com`;
    userId = await createTestUser(userEmail);
    await createBrandMembership(brandId, userId);
  });

  it("captures affected published products before deleting a manufacturer", async () => {
    // Delete a manufacturer after linking it to both published and unpublished products.
    const manufacturerId = crypto.randomUUID();
    await testDb.insert(schema.brandManufacturers).values({
      id: manufacturerId,
      brandId,
      name: `Manufacturer ${randomSuffix()}`,
    });

    const publishedProductId = await createProduct({
      brandId,
      manufacturerId,
      name: "Published Manufacturer Product",
      status: "published",
    });
    await createProduct({
      brandId,
      manufacturerId,
      name: "Unpublished Manufacturer Product",
      status: "unpublished",
    });

    const ctx = createMockContext({ brandId, userEmail, userId });
    await catalogRouter.createCaller(ctx).manufacturers.delete({
      id: manufacturerId,
    });

    expect(triggerCalls).toHaveLength(1);
    expect(triggerCalls[0]).toEqual({
      id: "catalog-fan-out",
      payload: {
        brandId,
        entityType: "manufacturer",
        entityId: manufacturerId,
        productIds: [publishedProductId],
      },
      options: {
        concurrencyKey: brandId,
        delay: "45s",
      },
    });

    const [product] = await testDb
      .select({ manufacturerId: schema.products.manufacturerId })
      .from(schema.products)
      .where(eq(schema.products.id, publishedProductId));

    expect(product?.manufacturerId).toBeNull();
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

    const productLinkedProductId = await createProduct({
      brandId,
      name: "Published Product Material Product",
      status: "published",
    });
    const variantLinkedProductId = await createProduct({
      brandId,
      name: "Published Variant Material Product",
      status: "published",
    });
    const unpublishedProductId = await createProduct({
      brandId,
      name: "Unpublished Certification Product",
      status: "unpublished",
    });

    await testDb.insert(schema.productMaterials).values([
      {
        productId: productLinkedProductId,
        brandMaterialId: productMaterialId,
      },
      {
        productId: unpublishedProductId,
        brandMaterialId: productMaterialId,
      },
    ]);

    const variantId = await createVariant(variantLinkedProductId);
    await testDb.insert(schema.variantMaterials).values({
      variantId,
      brandMaterialId: variantMaterialId,
    });

    const ctx = createMockContext({ brandId, userEmail, userId });
    await catalogRouter.createCaller(ctx).certifications.delete({
      id: certificationId,
    });

    expect(triggerCalls).toHaveLength(1);

    const queuedProductIds = [...(triggerCalls[0]?.payload.productIds ?? [])].sort();
    expect(triggerCalls[0]).toMatchObject({
      id: "catalog-fan-out",
      payload: {
        brandId,
        entityType: "certification",
        entityId: certificationId,
      },
      options: {
        concurrencyKey: brandId,
        delay: "45s",
      },
    });
    expect(queuedProductIds).toEqual(
      [productLinkedProductId, variantLinkedProductId].sort(),
    );

    const materials = await testDb
      .select({
        certificationId: schema.brandMaterials.certificationId,
        id: schema.brandMaterials.id,
      })
      .from(schema.brandMaterials)
      .where(eq(schema.brandMaterials.brandId, brandId));

    expect(materials).toEqual(
      expect.arrayContaining([
        { id: productMaterialId, certificationId: null },
        { id: variantMaterialId, certificationId: null },
      ]),
    );
  });
});
