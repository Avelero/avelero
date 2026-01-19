/**
 * Product attribute query functions.
 *
 * Provides functions for managing product attributes:
 * - Materials composition
 * - Environment metrics
 * - Journey steps
 * - Tags
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import {
  productEnvironment,
  productJourneySteps,
  productMaterials,
  productTags,
  productWeight,
  products,
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
 * Upserts product environment metrics.
 * Stores carbon and water as separate rows with metric type.
 * Note: Schema should support multiple rows per product (composite key on productId + metric).
 */
export async function upsertProductEnvironment(
  db: Database,
  productId: string,
  input: { carbonKgCo2e?: string; waterLiters?: string },
) {
  await db.transaction(async (tx) => {
    // Delete existing environment rows for this product and metric type
    const metricsToDelete: string[] = [];
    if (input.carbonKgCo2e !== undefined) {
      metricsToDelete.push("carbon_kg_co2e");
    }
    if (input.waterLiters !== undefined) {
      metricsToDelete.push("water_liters");
    }

    if (metricsToDelete.length > 0) {
      await tx
        .delete(productEnvironment)
        .where(
          and(
            eq(productEnvironment.productId, productId),
            inArray(productEnvironment.metric, metricsToDelete),
          )!,
        );
    }

    // Insert carbon metric if provided
    if (input.carbonKgCo2e) {
      await tx.insert(productEnvironment).values({
        productId,
        value: input.carbonKgCo2e,
        unit: "kgCO2e",
        metric: "carbon_kg_co2e",
      });
    }

    // Insert water metric if provided
    if (input.waterLiters) {
      await tx.insert(productEnvironment).values({
        productId,
        value: input.waterLiters,
        unit: "liters",
        metric: "water_liters",
      });
    }

    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { product_id: productId };
}

/**
 * Sets product journey steps (replaces all existing journey steps).
 * Each step can have multiple operators (operatorIds array).
 * One row is created per operator, all sharing the same sortIndex and stepType.
 */
export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; operatorIds: string[] }[],
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    // Delete existing journey steps
    await tx
      .delete(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId));

    // Flatten steps: one row per operator
    const flattenedSteps = steps.flatMap((step) =>
      step.operatorIds.map((operatorId) => ({
        productId,
        sortIndex: step.sortIndex,
        stepType: step.stepType,
        operatorId,
      })),
    );

    if (!flattenedSteps.length) {
      countInserted = 0;
    } else {
      // Insert journey steps with their operators
      const rows = await tx
        .insert(productJourneySteps)
        .values(flattenedSteps)
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
    await tx.delete(productTags).where(eq(productTags.productId, productId));
    if (tagIds.length === 0) {
      return;
    }
    await tx
      .insert(productTags)
      .values(tagIds.map((tagId) => ({ productId, tagId })));
    const [{ brandId } = { brandId: undefined } as any] = await tx
      .select({ brandId: products.brandId })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);
  });
  return { count: tagIds.length } as const;
}

/**
 * Upserts product weight.
 * Weight is stored in grams by default.
 */
export async function upsertProductWeight(
  db: Database,
  productId: string,
  input: { weight?: string; weightUnit?: string },
) {
  await db.transaction(async (tx) => {
    // Check if weight record exists
    const [existing] = await tx
      .select({ productId: productWeight.productId })
      .from(productWeight)
      .where(eq(productWeight.productId, productId))
      .limit(1);

    const now = new Date().toISOString();

    // If weight is empty/undefined, delete existing record
    if (!input.weight) {
      if (existing) {
        await tx
          .delete(productWeight)
          .where(eq(productWeight.productId, productId));
      }
      return;
    }

    if (existing) {
      // Update existing record
      await tx
        .update(productWeight)
        .set({
          weight: input.weight,
          weightUnit: input.weightUnit ?? "g",
          updatedAt: now,
        })
        .where(eq(productWeight.productId, productId));
    } else {
      // Insert new record
      await tx.insert(productWeight).values({
        productId,
        weight: input.weight,
        weightUnit: input.weightUnit ?? "g",
        createdAt: now,
        updatedAt: now,
      });
    }
  });
  return { product_id: productId };
}
