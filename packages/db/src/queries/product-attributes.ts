import { and, asc, eq, inArray, notInArray } from "drizzle-orm";
import type { Database } from "../client";
import {
  productCareCodes,
  productEcoClaims,
  productEnvironment,
  productJourneySteps,
  productMaterials,
} from "../schema";

export async function upsertProductMaterials(
  db: Database,
  productId: string,
  items: { brandMaterialId: string; percentage?: string | number }[],
) {
  // Replace existing rows for product with provided set (idempotent by unique index)
  await db
    .delete(productMaterials)
    .where(eq(productMaterials.productId, productId));
  if (!items.length) return { count: 0 } as const;
  const rows = await db
    .insert(productMaterials)
    .values(
      items.map((i) => ({
        productId,
        brandMaterialId: i.brandMaterialId,
        percentage: i.percentage !== undefined ? String(i.percentage) : null,
      })),
    )
    .returning({ id: productMaterials.id });
  return { count: rows.length } as const;
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
) {
  const [row] = await db
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
  return row;
}

export async function setProductJourneySteps(
  db: Database,
  productId: string,
  steps: { sortIndex: number; stepType: string; facilityId: string }[],
) {
  await db
    .delete(productJourneySteps)
    .where(eq(productJourneySteps.productId, productId));
  if (!steps.length) return { count: 0 } as const;
  const rows = await db
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
  return { count: rows.length } as const;
}

