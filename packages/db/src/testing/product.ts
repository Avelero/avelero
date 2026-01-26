/**
 * Product Test Helpers
 *
 * Simple helper functions for creating test products and variants.
 * These are minimal helpers for general testing - not the full-featured
 * export helpers which include all related data.
 *
 * @module @v1/db/testing/product
 */

import * as schema from "../schema/index";
import { testDb } from "./connection";

// ============================================================================
// Types
// ============================================================================

export interface CreateTestProductOptions {
  name?: string;
  productHandle?: string;
  description?: string;
  status?: string;
}

export interface CreateTestVariantOptions {
  upid?: string;
  sku?: string;
  barcode?: string | null;
  isGhost?: boolean;
}

export interface TestProduct {
  id: string;
  brandId: string;
  name: string;
  productHandle: string;
}

export interface TestVariant {
  id: string;
  productId: string;
  upid: string | null;
  sku: string | null;
  barcode: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a simple test product.
 * Returns the created product with id, brandId, name, and productHandle.
 */
export async function createTestProduct(
  brandId: string,
  options: CreateTestProductOptions = {},
): Promise<TestProduct> {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const name = options.name ?? `Test Product ${randomSuffix}`;
  const productHandle = options.productHandle ?? `test-product-${randomSuffix}`;

  const [product] = await testDb
    .insert(schema.products)
    .values({
      brandId,
      name,
      productHandle,
      description: options.description,
      status: options.status ?? "draft",
    })
    .returning({
      id: schema.products.id,
      brandId: schema.products.brandId,
      name: schema.products.name,
      productHandle: schema.products.productHandle,
    });

  if (!product) {
    throw new Error("Failed to create test product");
  }

  return product;
}

/**
 * Creates a simple test variant.
 * Returns the created variant with id, productId, upid, sku, and barcode.
 */
export async function createTestVariant(
  productId: string,
  options: CreateTestVariantOptions = {},
): Promise<TestVariant> {
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const upid = options.upid ?? `UPID-${randomSuffix}`;

  const [variant] = await testDb
    .insert(schema.productVariants)
    .values({
      productId,
      upid,
      sku: options.sku ?? null,
      barcode: options.barcode ?? null,
      isGhost: options.isGhost ?? false,
    })
    .returning({
      id: schema.productVariants.id,
      productId: schema.productVariants.productId,
      upid: schema.productVariants.upid,
      sku: schema.productVariants.sku,
      barcode: schema.productVariants.barcode,
    });

  if (!variant) {
    throw new Error("Failed to create test variant");
  }

  return variant;
}
