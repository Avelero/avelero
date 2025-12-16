/**
 * Product attribute query functions.
 * 
 * Provides functions for managing product attributes:
 * - Materials composition
 * - Eco claims
 * - Environment metrics
 * - Journey steps
 * - Tags
 */

import { eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  products,
  tagsOnProduct,
} from "../../schema";

/**
 * Upserts product materials (replaces all existing materials).
 */
export async function upsertProductMaterials(
  db: Database,
  productId: string,
  items: { brandMaterialId: string; percentage?: string | number }[],
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    await tx
      .delete(productMaterials)
      .where(eq(productMaterials.productId, productId));
    if (!items.length) {
      countInserted = 0;
    } else {
      const rows = await tx
        .insert(productMaterials)
        .values(
          items.map((i) => ({
            productId,
            brandMaterialId: i.brandMaterialId,
            percentage:
              i.percentage !== undefined ? String(i.percentage) : null,
          })),
        )
        .returning({ id: productMaterials.id });
      countInserted = rows.length;
    }
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: countInserted } as const;
}

/**
 * Sets product eco claims (replaces all existing eco claims).
 */
export async function setProductEcoClaims(
  db: Database,
  productId: string,
  ecoClaimIds: string[],
) {
  const existing = await db
    .select({
      id: productEcoClaims.id,
      ecoClaimId: productEcoClaims.ecoClaimId,
    })
    .from(productEcoClaims)
    .where(eq(productEcoClaims.productId, productId));
  const existingIds = new Set(existing.map((r) => r.ecoClaimId));
  const toInsert = ecoClaimIds.filter((id) => !existingIds.has(id));
  const toDelete = existing.filter((r) => !ecoClaimIds.includes(r.ecoClaimId));
  if (toDelete.length) {
    await db.delete(productEcoClaims).where(
      inArray(
        productEcoClaims.id,
        toDelete.map((r) => r.id),
      ),
    );
  }
  if (toInsert.length) {
    await db
      .insert(productEcoClaims)
      .values(toInsert.map((id) => ({ productId, ecoClaimId: id })));
  }
  return { count: ecoClaimIds.length } as const;
}

/**
 * Upserts product environment metrics.
 */
export async function upsertProductEnvironment(
  db: Database,
  productId: string,
  input: { carbonKgCo2e?: string; waterLiters?: string },
) {
  let result: { product_id: string } | undefined;
  await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(productEnvironment)
      .values({
        productId,
        carbonKgCo2e: input.carbonKgCo2e ?? null,
        waterLiters: input.waterLiters ?? null,
      })
      .onConflictDoUpdate({
        target: productEnvironment.productId,
        set: {
          carbonKgCo2e: input.carbonKgCo2e ?? null,
          waterLiters: input.waterLiters ?? null,
        },
      })
      .returning({ product_id: productEnvironment.productId });
    result = row;
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return result as { product_id: string };
}

/**
 * Sets product journey steps (replaces all existing journey steps).
 */
export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; facilityId: string }[],
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    // Delete existing journey steps
    await tx
      .delete(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId));

    if (!steps.length) {
      countInserted = 0;
    } else {
      // Insert journey steps with their facility
      const rows = await tx
        .insert(productJourneySteps)
        .values(
          steps.map((s) => ({
            productId,
            sortIndex: s.sortIndex,
            stepType: s.stepType,
            facilityId: s.facilityId,
          })),
        )
        .returning({ id: productJourneySteps.id });

      countInserted = rows.length;
    }

    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: countInserted } as const;
}

/**
 * Sets product tags (replaces all existing tags).
 */
export async function setProductTags(
  db: Database,
  productId: string,
  tagIds: string[],
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(tagsOnProduct)
      .where(eq(tagsOnProduct.productId, productId));
    if (tagIds.length === 0) {
      return;
    }
    await tx
      .insert(tagsOnProduct)
      .values(tagIds.map((tagId) => ({ productId, tagId })));
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: tagIds.length } as const;
}

