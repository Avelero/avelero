/**
 * Test Database Utility for Bulk Import Tests
 *
 * Provides database helpers specific to bulk import testing,
 * including product/variant retrieval and import job management.
 *
 * @module @v1/testing/bulk-import/test-database
 */

import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../../client";
import * as schema from "../../schema/index";

// ============================================================================
// Types
// ============================================================================

export interface DbTestProduct {
  id: string;
  productHandle: string;
  name: string;
  description: string | null;
  imagePath: string | null;
  brandId: string;
  manufacturerId: string | null;
  categoryId: string | null;
  seasonId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbTestVariant {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  upid: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DbTestImportJob {
  id: string;
  brandId: string;
  filename: string;
  status: string;
  mode: string;
  startedAt: string;
  finishedAt: string | null;
  summary: Record<string, unknown> | null;
}

// ============================================================================
// Test Database Class
// ============================================================================

/**
 * Database utilities for bulk import integration tests.
 *
 * @example
 * ```typescript
 * // Get a product by handle
 * const product = await TestDatabase.getProductByHandle(db, brandId, "test-handle");
 *
 * // Get all variants for a product
 * const variants = await TestDatabase.getVariantsByProductId(db, product.id);
 * ```
 */
export class TestDatabase {
  // ========================================================================
  // Product Operations
  // ========================================================================

  /**
   * Get a product by its handle
   */
  static async getProductByHandle(
    db: Database,
    brandId: string,
    productHandle: string,
  ): Promise<DbTestProduct | null> {
    const results = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.brandId, brandId),
          eq(schema.products.productHandle, productHandle),
        ),
      )
      .limit(1);

    const product = results[0];
    if (!product) return null;

    return {
      id: product.id,
      productHandle: product.productHandle,
      name: product.name,
      description: product.description,
      imagePath: product.imagePath,
      brandId: product.brandId,
      manufacturerId: product.manufacturerId,
      categoryId: product.categoryId,
      seasonId: product.seasonId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Get a product by ID
   */
  static async getProductById(
    db: Database,
    productId: string,
  ): Promise<DbTestProduct | null> {
    const results = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, productId))
      .limit(1);

    const product = results[0];
    if (!product) return null;

    return {
      id: product.id,
      productHandle: product.productHandle,
      name: product.name,
      description: product.description,
      imagePath: product.imagePath,
      brandId: product.brandId,
      manufacturerId: product.manufacturerId,
      categoryId: product.categoryId,
      seasonId: product.seasonId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };
  }

  /**
   * Get all products for a brand
   */
  static async getProductsByBrand(
    db: Database,
    brandId: string,
  ): Promise<DbTestProduct[]> {
    const results = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.brandId, brandId));

    return results.map((product) => ({
      id: product.id,
      productHandle: product.productHandle,
      name: product.name,
      description: product.description,
      imagePath: product.imagePath,
      brandId: product.brandId,
      manufacturerId: product.manufacturerId,
      categoryId: product.categoryId,
      seasonId: product.seasonId,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    }));
  }

  /**
   * Get product count for a brand
   */
  static async getProductCount(db: Database, brandId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(eq(schema.products.brandId, brandId));

    return result[0]?.count ?? 0;
  }

  // ========================================================================
  // Variant Operations
  // ========================================================================

  /**
   * Get a variant by SKU
   */
  static async getVariantBySku(
    db: Database,
    brandId: string,
    sku: string,
  ): Promise<DbTestVariant | null> {
    const results = await db
      .select({
        id: schema.productVariants.id,
        productId: schema.productVariants.productId,
        sku: schema.productVariants.sku,
        barcode: schema.productVariants.barcode,
        upid: schema.productVariants.upid,
        createdAt: schema.productVariants.createdAt,
        updatedAt: schema.productVariants.updatedAt,
      })
      .from(schema.productVariants)
      .innerJoin(
        schema.products,
        eq(schema.productVariants.productId, schema.products.id),
      )
      .where(
        and(
          eq(schema.products.brandId, brandId),
          eq(schema.productVariants.sku, sku),
        ),
      )
      .limit(1);

    const variant = results[0];
    if (!variant) return null;

    return variant;
  }

  /**
   * Get a variant by barcode
   */
  static async getVariantByBarcode(
    db: Database,
    brandId: string,
    barcode: string,
  ): Promise<DbTestVariant | null> {
    const results = await db
      .select({
        id: schema.productVariants.id,
        productId: schema.productVariants.productId,
        sku: schema.productVariants.sku,
        barcode: schema.productVariants.barcode,
        upid: schema.productVariants.upid,
        createdAt: schema.productVariants.createdAt,
        updatedAt: schema.productVariants.updatedAt,
      })
      .from(schema.productVariants)
      .innerJoin(
        schema.products,
        eq(schema.productVariants.productId, schema.products.id),
      )
      .where(
        and(
          eq(schema.products.brandId, brandId),
          eq(schema.productVariants.barcode, barcode),
        ),
      )
      .limit(1);

    const variant = results[0];
    if (!variant) return null;

    return variant;
  }

  /**
   * Get a variant by UPID
   */
  static async getVariantByUpid(
    db: Database,
    upid: string,
  ): Promise<DbTestVariant | null> {
    const results = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.upid, upid))
      .limit(1);

    const variant = results[0];
    if (!variant) return null;

    return {
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      barcode: variant.barcode,
      upid: variant.upid,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    };
  }

  /**
   * Get all variants for a product
   */
  static async getVariantsByProductId(
    db: Database,
    productId: string,
  ): Promise<DbTestVariant[]> {
    const results = await db
      .select()
      .from(schema.productVariants)
      .where(eq(schema.productVariants.productId, productId));

    return results.map((variant) => ({
      id: variant.id,
      productId: variant.productId,
      sku: variant.sku,
      barcode: variant.barcode,
      upid: variant.upid,
      createdAt: variant.createdAt,
      updatedAt: variant.updatedAt,
    }));
  }

  /**
   * Get variant count for a brand
   */
  static async getVariantCount(db: Database, brandId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.productVariants)
      .innerJoin(
        schema.products,
        eq(schema.productVariants.productId, schema.products.id),
      )
      .where(eq(schema.products.brandId, brandId));

    return result[0]?.count ?? 0;
  }

  // ========================================================================
  // Import Job Operations
  // ========================================================================

  /**
   * Get an import job by ID
   */
  static async getImportJob(
    db: Database,
    jobId: string,
  ): Promise<DbTestImportJob | null> {
    const results = await db
      .select()
      .from(schema.importJobs)
      .where(eq(schema.importJobs.id, jobId))
      .limit(1);

    const job = results[0];
    if (!job) return null;

    return {
      id: job.id,
      brandId: job.brandId,
      filename: job.filename,
      status: job.status,
      mode: job.mode,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      summary: job.summary as Record<string, unknown> | null,
    };
  }

  /**
   * Create a test import job
   */
  static async createImportJob(
    db: Database,
    brandId: string,
    options?: {
      filename?: string;
      status?: string;
      mode?: "CREATE" | "CREATE_AND_ENRICH";
    },
  ): Promise<DbTestImportJob> {
    const results = await db
      .insert(schema.importJobs)
      .values({
        brandId,
        filename: options?.filename ?? "test-import.xlsx",
        status: options?.status ?? "PENDING",
        mode: options?.mode ?? "CREATE",
      })
      .returning();

    const job = results[0];
    if (!job) {
      throw new Error("Failed to create test import job");
    }

    return {
      id: job.id,
      brandId: job.brandId,
      filename: job.filename,
      status: job.status,
      mode: job.mode,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      summary: job.summary as Record<string, unknown> | null,
    };
  }

  // ========================================================================
  // Related Data Operations
  // ========================================================================

  /**
   * Get product tags
   */
  static async getProductTags(
    db: Database,
    productId: string,
  ): Promise<string[]> {
    const results = await db
      .select({ tagName: schema.brandTags.name })
      .from(schema.productTags)
      .innerJoin(
        schema.brandTags,
        eq(schema.productTags.tagId, schema.brandTags.id),
      )
      .where(eq(schema.productTags.productId, productId));

    return results.map((r) => r.tagName);
  }

  /**
   * Get product materials
   * Note: productMaterials uses brandMaterialId, not materialId
   */
  static async getProductMaterials(
    db: Database,
    productId: string,
  ): Promise<Array<{ name: string; percentage: string | null }>> {
    const results = await db
      .select({
        name: schema.brandMaterials.name,
        percentage: schema.productMaterials.percentage,
      })
      .from(schema.productMaterials)
      .innerJoin(
        schema.brandMaterials,
        eq(schema.productMaterials.brandMaterialId, schema.brandMaterials.id),
      )
      .where(eq(schema.productMaterials.productId, productId));

    return results;
  }

  /**
   * Get variant attributes
   * Note: productVariantAttributes uses attributeValueId linking to brandAttributeValues
   */
  static async getVariantAttributes(
    db: Database,
    variantId: string,
  ): Promise<Array<{ attributeName: string; valueName: string }>> {
    const results = await db
      .select({
        attributeName: schema.brandAttributes.name,
        valueName: schema.brandAttributeValues.name,
      })
      .from(schema.productVariantAttributes)
      .innerJoin(
        schema.brandAttributeValues,
        eq(
          schema.productVariantAttributes.attributeValueId,
          schema.brandAttributeValues.id,
        ),
      )
      .innerJoin(
        schema.brandAttributes,
        eq(schema.brandAttributeValues.attributeId, schema.brandAttributes.id),
      )
      .where(eq(schema.productVariantAttributes.variantId, variantId));

    return results;
  }

  /**
   * Get product journey steps
   * Note: brandOperators uses displayName, not name
   */
  static async getProductJourneySteps(
    db: Database,
    productId: string,
  ): Promise<Array<{ stepType: string; operatorName: string | null }>> {
    const results = await db
      .select({
        stepType: schema.productJourneySteps.stepType,
        operatorName: schema.brandOperators.displayName,
      })
      .from(schema.productJourneySteps)
      .leftJoin(
        schema.brandOperators,
        eq(schema.productJourneySteps.operatorId, schema.brandOperators.id),
      )
      .where(eq(schema.productJourneySteps.productId, productId));

    return results;
  }
}
