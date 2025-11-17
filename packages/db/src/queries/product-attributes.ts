import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import type { Database } from "../client";
import { evaluateAndUpsertCompletion } from "../completion/evaluate";
import type { ModuleKey } from "../completion/module-keys";
import {
  productCareCodes,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productMaterials,
  products,
} from "../schema";

type CompletionEvalOptions = {
  skipCompletionEval?: boolean;
};

export async function upsertProductMaterials(
  db: Database,
  productId: string,
  items: { brandMaterialId: string; percentage?: string | number }[],
  options?: CompletionEvalOptions,
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    // Replace existing rows for product with provided set (idempotent by unique index)
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
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["materials"] as ModuleKey[],
        },
      );
    }
  });
  return { count: countInserted } as const;
}

export async function setProductCareCodes(
  db: Database,
  productId: string,
  careCodeIds: string[],
) {
  // Delete not-in-set, insert missing
  const existing = await db
    .select({
      id: productCareCodes.id,
      careCodeId: productCareCodes.careCodeId,
    })
    .from(productCareCodes)
    .where(eq(productCareCodes.productId, productId));
  const existingIds = new Set(existing.map((r) => r.careCodeId));
  const toInsert = careCodeIds.filter((id) => !existingIds.has(id));
  const toDelete = existing.filter((r) => !careCodeIds.includes(r.careCodeId));
  if (toDelete.length) {
    await db.delete(productCareCodes).where(
      inArray(
        productCareCodes.id,
        toDelete.map((r) => r.id),
      ),
    );
  }
  if (toInsert.length) {
    await db
      .insert(productCareCodes)
      .values(toInsert.map((id) => ({ productId, careCodeId: id })));
  }
  return { count: careCodeIds.length } as const;
}

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

export async function upsertProductEnvironment(
  db: Database,
  productId: string,
  input: { carbonKgCo2e?: string; waterLiters?: string },
  options?: CompletionEvalOptions,
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
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["environment"] as ModuleKey[],
        },
      );
    }
  });
  return result as { product_id: string };
}

export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; facilityId: string }[],
  options?: CompletionEvalOptions,
) {
  let countInserted = 0;
  await db.transaction(async (tx) => {
    await tx
      .delete(productJourneySteps)
      .where(eq(productJourneySteps.productId, productId));
    if (!steps.length) {
      countInserted = 0;
    } else {
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
    if (brandId && !options?.skipCompletionEval) {
      await evaluateAndUpsertCompletion(
        tx as unknown as Database,
        brandId,
        productId,
        {
          onlyModules: ["journey"] as ModuleKey[],
        },
      );
    }
  });
  return { count: countInserted } as const;
}
