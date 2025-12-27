import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandEcoClaims } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listEcoClaims(db: Database, brandId: string) {
  return db
    .select({
      id: brandEcoClaims.id,
      claim: brandEcoClaims.claim,
      created_at: brandEcoClaims.createdAt,
      updated_at: brandEcoClaims.updatedAt,
    })
    .from(brandEcoClaims)
    .where(eq(brandEcoClaims.brandId, brandId))
    .orderBy(asc(brandEcoClaims.claim));
}

export async function createEcoClaim(
  db: Database,
  brandId: string,
  input: { claim: string },
) {
  const [row] = await db
    .insert(brandEcoClaims)
    .values({ brandId, claim: input.claim })
    .returning({ id: brandEcoClaims.id });
  return row;
}

export async function updateEcoClaim(
  db: Database,
  brandId: string,
  id: string,
  input: { claim?: string },
) {
  const updateData = buildPartialUpdate(input);

  const [row] = await db
    .update(brandEcoClaims)
    .set(updateData)
    .where(and(eq(brandEcoClaims.id, id), eq(brandEcoClaims.brandId, brandId)))
    .returning({ id: brandEcoClaims.id });
  return row;
}

export async function deleteEcoClaim(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandEcoClaims)
    .where(and(eq(brandEcoClaims.id, id), eq(brandEcoClaims.brandId, brandId)))
    .returning({ id: brandEcoClaims.id });
  return row;
}









