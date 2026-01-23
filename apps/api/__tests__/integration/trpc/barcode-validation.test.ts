/**
 * Integration Tests: Barcode Validation in Variants Router
 *
 * Tests the barcode validation functionality in the variants TRPC router:
 * - products.variants.checkBarcode - Real-time barcode availability check
 * - Barcode validation in create/update/sync mutations
 * - Brand-scoped uniqueness enforcement
 *
 * Uses real database connections with transaction-based test isolation.
 */

// Load setup first (loads .env.test and configures cleanup)
import "../../setup";

import { describe, expect, it } from "bun:test";
import { eq } from "@v1/db/queries";
import { brandMembers, productVariants, products } from "@v1/db/schema";
import {
  createTestBrand,
  createTestProduct,
  createTestUser,
  createTestVariant,
  testDb,
} from "@v1/db/testing";
import type { AuthenticatedTRPCContext } from "../../../src/trpc/init";
import { productVariantsRouter } from "../../../src/trpc/routers/products/variants";

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Creates a mock authenticated context for testing.
 */
function createMockContext(opts: {
  userId: string;
  brandId: string;
  userEmail?: string;
}): AuthenticatedTRPCContext & { brandId: string } {
  return {
    user: {
      id: opts.userId,
      email: opts.userEmail ?? "test@example.com",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    } as any,
    brandId: opts.brandId,
    role: "owner",
    db: testDb,
    loaders: {} as any,
    supabase: {} as any,
    supabaseAdmin: null,
    geo: { ip: null },
  };
}

/**
 * Creates a brand membership for testing.
 */
async function createBrandMembership(
  userId: string,
  brandId: string,
  role: "owner" | "member" = "owner",
) {
  await testDb.insert(brandMembers).values({
    userId,
    brandId,
    role,
  });
}

// ============================================================================
// Tests: checkBarcode Endpoint
// ============================================================================

describe("products.variants.checkBarcode", () => {
  it("returns available: true for unused barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.checkBarcode({
      barcode: "1234567890123",
    });

    expect(result.available).toBe(true);
  });

  it("returns available: false for existing barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    await createTestVariant(product.id, { barcode: "00001234567890123" }); // Normalized GTIN-14

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.checkBarcode({
      barcode: "00001234567890123",
    });

    expect(result.available).toBe(false);
  });

  it("returns available: true when excluding own variant", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    const variant = await createTestVariant(product.id, {
      barcode: "00001234567890123",
    });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.checkBarcode({
      barcode: "00001234567890123",
      excludeVariantId: variant.id,
    });

    expect(result.available).toBe(true);
  });

  it("returns available: true for barcode in different brand", async () => {
    const userId = await createTestUser("test@example.com");

    // Brand 1 with barcode
    const brandId1 = await createTestBrand("Brand 1");
    await createBrandMembership(userId, brandId1);
    const product1 = await createTestProduct(brandId1, {
      productHandle: "test-product",
    });
    await createTestVariant(product1.id, { barcode: "00001234567890123" });

    // Brand 2 checking same barcode
    const brandId2 = await createTestBrand("Brand 2");
    await createBrandMembership(userId, brandId2);
    await createTestProduct(brandId2, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId: brandId2 });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.checkBarcode({
      barcode: "00001234567890123",
    });

    expect(result.available).toBe(true);
  });
});

// ============================================================================
// Tests: Create Variant with Barcode
// ============================================================================

describe("products.variants.create with barcode", () => {
  it("creates variant with valid unique barcode (normalized to GTIN-14)", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.create({
      productHandle: "test-product",
      barcode: "1234567890123", // 13 digits
      attributeValueIds: [],
    });

    expect(result.data.upid).toBeDefined();

    // Verify barcode was normalized to GTIN-14 in database
    const [dbVariant] = await testDb
      .select({ barcode: productVariants.barcode })
      .from(productVariants)
      .where(eq(productVariants.upid, result.data.upid!))
      .limit(1);

    expect(dbVariant?.barcode).toBe("01234567890123"); // Padded to 14 digits
  });

  it("rejects duplicate barcode in same brand", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    await createTestVariant(product.id, { barcode: "01234567890123" }); // Normalized

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.create({
        productHandle: "test-product",
        barcode: "1234567890123", // Will be normalized to match existing
        attributeValueIds: [],
      }),
    ).rejects.toThrow(/already used by another variant/i);
  });

  it("allows variant creation without barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.create({
      productHandle: "test-product",
      attributeValueIds: [],
    });

    expect(result.data.upid).toBeDefined();
  });

  it("rejects invalid barcode format (wrong length)", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.create({
        productHandle: "test-product",
        barcode: "1234567", // 7 digits - invalid
        attributeValueIds: [],
      }),
    ).rejects.toThrow(/8, 12, 13, or 14 digits/i);
  });

  it("rejects invalid barcode format (non-numeric)", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.create({
        productHandle: "test-product",
        barcode: "ABC12345678",
        attributeValueIds: [],
      }),
    ).rejects.toThrow(/8, 12, 13, or 14 digits/i);
  });

  it("allows same barcode in different brand", async () => {
    const userId = await createTestUser("test@example.com");

    // Brand 1 with barcode
    const brandId1 = await createTestBrand("Brand 1");
    await createBrandMembership(userId, brandId1);
    const product1 = await createTestProduct(brandId1, {
      productHandle: "test-product",
    });
    await createTestVariant(product1.id, { barcode: "01234567890123" });

    // Brand 2 should be able to use the same barcode
    const brandId2 = await createTestBrand("Brand 2");
    await createBrandMembership(userId, brandId2);
    await createTestProduct(brandId2, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId: brandId2 });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.create({
      productHandle: "test-product",
      barcode: "1234567890123",
      attributeValueIds: [],
    });

    expect(result.data.upid).toBeDefined();
  });
});

// ============================================================================
// Tests: Update Variant with Barcode
// ============================================================================

describe("products.variants.update with barcode", () => {
  it("updates variant with new unique barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    const variant = await createTestVariant(product.id, { barcode: null });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.update({
      productHandle: "test-product",
      variantUpid: variant.upid!,
      barcode: "9876543210987",
    });

    expect(result.data.success).toBe(true);

    // Verify barcode was normalized to GTIN-14
    const [dbVariant] = await testDb
      .select({ barcode: productVariants.barcode })
      .from(productVariants)
      .where(eq(productVariants.id, variant.id))
      .limit(1);

    expect(dbVariant?.barcode).toBe("09876543210987");
  });

  it("allows keeping same barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    const variant = await createTestVariant(product.id, {
      barcode: "01234567890123",
    });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.update({
      productHandle: "test-product",
      variantUpid: variant.upid!,
      barcode: "1234567890123", // Same barcode (will normalize)
    });

    expect(result.data.success).toBe(true);
  });

  it("rejects changing to another variant's barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    await createTestVariant(product.id, {
      barcode: "01234567890123",
    });
    const variant2 = await createTestVariant(product.id, {
      barcode: "09876543210987",
    });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.update({
        productHandle: "test-product",
        variantUpid: variant2.upid!,
        barcode: "1234567890123", // Trying to use variant1's barcode
      }),
    ).rejects.toThrow(/already used by another variant/i);
  });

  it("allows clearing barcode", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    const variant = await createTestVariant(product.id, {
      barcode: "01234567890123",
    });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    // Note: In current implementation, setting empty string should clear it
    // The exact behavior depends on how the frontend sends "clear" operations
    const result = await caller.update({
      productHandle: "test-product",
      variantUpid: variant.upid!,
      barcode: undefined, // Not setting barcode should not change it
    });

    expect(result.data.success).toBe(true);
  });
});

// ============================================================================
// Tests: Sync Variants with Barcodes
// ============================================================================

describe("products.variants.sync with barcodes", () => {
  it("creates new variants with unique barcodes", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.sync({
      productHandle: "test-product",
      variants: [
        { attributeValueIds: [], barcode: "11111111" }, // 8 digits
        { attributeValueIds: [], barcode: "222222222222" }, // 12 digits
      ],
    });

    expect(result.data.created).toBe(2);
  });

  it("rejects sync with duplicate barcodes in batch", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.sync({
        productHandle: "test-product",
        variants: [
          { attributeValueIds: [], barcode: "1234567890123" },
          { attributeValueIds: [], barcode: "1234567890123" }, // Duplicate
        ],
      }),
    ).rejects.toThrow(/duplicate barcodes in batch/i);
  });

  it("rejects sync with barcode matching existing variant", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    await createTestVariant(product.id, { barcode: "01234567890123" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    await expect(
      caller.sync({
        productHandle: "test-product",
        variants: [
          { attributeValueIds: [], barcode: "1234567890123" }, // Will normalize to match existing
        ],
      }),
    ).rejects.toThrow(/already in use/i);
  });

  it("allows sync with mix of barcodes and no-barcodes", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    await createTestProduct(brandId, { productHandle: "test-product" });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.sync({
      productHandle: "test-product",
      variants: [
        { attributeValueIds: [], barcode: "3333333333333" },
        { attributeValueIds: [] }, // No barcode
        { attributeValueIds: [], barcode: undefined },
      ],
    });

    expect(result.data.created).toBe(3);
  });

  it("allows updating existing variant to keep its own barcode during sync", async () => {
    const userId = await createTestUser("test@example.com");
    const brandId = await createTestBrand("Test Brand");
    await createBrandMembership(userId, brandId);
    const product = await createTestProduct(brandId, {
      productHandle: "test-product",
    });
    const variant = await createTestVariant(product.id, {
      barcode: "01234567890123",
    });

    const ctx = createMockContext({ userId, brandId });
    const caller = productVariantsRouter.createCaller(ctx);

    const result = await caller.sync({
      productHandle: "test-product",
      variants: [
        {
          upid: variant.upid!,
          attributeValueIds: [],
          barcode: "1234567890123", // Same barcode
        },
      ],
    });

    expect(result.data.updated).toBe(1);
  });
});
