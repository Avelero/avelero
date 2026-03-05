/**
 * Catalog Fan-Out Resolvers.
 *
 * Resolves which published product IDs are affected by a change to a catalog
 * entity (manufacturer, material, certification, operator). Used by the
 * background catalog fan-out job to identify which passports need republishing.
 *
 * All resolvers return deduplicated product IDs for published products only.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandMaterials,
  productJourneySteps,
  productMaterials,
  productVariants,
  products,
  variantJourneySteps,
  variantMaterials,
} from "../../schema";

/**
 * Resolve published product IDs for one or more material IDs.
 */
async function findPublishedProductIdsByMaterialIds(
  db: Database,
  brandId: string,
  materialIds: string[],
): Promise<string[]> {
  // Resolve both product-level and variant-level material references.
  if (materialIds.length === 0) {
    return [];
  }

  const productIds = new Set<string>();

  const viaProduct = await db
    .select({ productId: productMaterials.productId })
    .from(productMaterials)
    .innerJoin(products, eq(products.id, productMaterials.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(productMaterials.brandMaterialId, materialIds),
        eq(products.status, "published"),
      ),
    );

  for (const row of viaProduct) {
    productIds.add(row.productId);
  }

  const viaVariant = await db
    .select({ productId: productVariants.productId })
    .from(variantMaterials)
    .innerJoin(
      productVariants,
      eq(productVariants.id, variantMaterials.variantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        inArray(variantMaterials.brandMaterialId, materialIds),
        eq(products.status, "published"),
      ),
    );

  for (const row of viaVariant) {
    productIds.add(row.productId);
  }

  return Array.from(productIds);
}

/**
 * Find published product IDs affected by a manufacturer change.
 *
 * Manufacturers link directly to products via products.manufacturer_id.
 */
export async function findPublishedProductIdsByManufacturer(
  db: Database,
  brandId: string,
  manufacturerId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: products.id })
    .from(products)
    .where(
      and(
        eq(products.brandId, brandId),
        eq(products.manufacturerId, manufacturerId),
        eq(products.status, "published"),
      ),
    );

  return rows.map((r) => r.id);
}

/**
 * Find published product IDs affected by a material change.
 *
 * A material can appear on a product via product_materials or on individual
 * variants via variant_materials. We resolve both paths and deduplicate.
 */
export async function findPublishedProductIdsByMaterial(
  db: Database,
  brandId: string,
  materialId: string,
): Promise<string[]> {
  // Delegate single-material lookups to the shared material resolver.
  return findPublishedProductIdsByMaterialIds(db, brandId, [materialId]);
}

/**
 * Find published product IDs affected by a certification change.
 *
 * Certifications link to materials via brand_materials.certification_id.
 * We first resolve which materials reference this certification, then
 * delegate to the material resolver for both product and variant paths.
 */
export async function findPublishedProductIdsByCertification(
  db: Database,
  brandId: string,
  certificationId: string,
): Promise<string[]> {
  // Resolve linked materials first, then reuse the shared material resolver.
  // Step 1: find materials that reference this certification
  const affectedMaterials = await db
    .select({ id: brandMaterials.id })
    .from(brandMaterials)
    .where(
      and(
        eq(brandMaterials.brandId, brandId),
        eq(brandMaterials.certificationId, certificationId),
      ),
    );

  if (affectedMaterials.length === 0) {
    return [];
  }

  return findPublishedProductIdsByMaterialIds(
    db,
    brandId,
    affectedMaterials.map((material) => material.id),
  );
}

/**
 * Find published product IDs affected by an operator change.
 *
 * Operators appear on journey steps, which can be at product level
 * (product_journey_steps) or variant level (variant_journey_steps).
 * We resolve both paths and deduplicate.
 */
export async function findPublishedProductIdsByOperator(
  db: Database,
  brandId: string,
  operatorId: string,
): Promise<string[]> {
  const productIds = new Set<string>();

  // Path 1: product_journey_steps → products
  const viaProduct = await db
    .select({ productId: productJourneySteps.productId })
    .from(productJourneySteps)
    .innerJoin(products, eq(products.id, productJourneySteps.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        eq(productJourneySteps.operatorId, operatorId),
        eq(products.status, "published"),
      ),
    );

  for (const r of viaProduct) {
    productIds.add(r.productId);
  }

  // Path 2: variant_journey_steps → product_variants → products
  const viaVariant = await db
    .select({ productId: productVariants.productId })
    .from(variantJourneySteps)
    .innerJoin(
      productVariants,
      eq(productVariants.id, variantJourneySteps.variantId),
    )
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(
      and(
        eq(products.brandId, brandId),
        eq(variantJourneySteps.operatorId, operatorId),
        eq(products.status, "published"),
      ),
    );

  for (const r of viaVariant) {
    productIds.add(r.productId);
  }

  return Array.from(productIds);
}
