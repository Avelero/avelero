import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandTags } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listBrandTags(db: Database, brandId: string) {
  return db
    .select({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    })
    .from(brandTags)
    .where(eq(brandTags.brandId, brandId))
    .orderBy(asc(brandTags.name));
}

export async function createBrandTag(
  db: Database,
  brandId: string,
  input: { name: string; hex?: string | null },
) {
  const [row] = await db
    .insert(brandTags)
    .values({
      brandId,
      name: input.name,
      hex: input.hex ?? null,
    })
    .returning({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    });
  return row;
}

export async function updateBrandTag(
  db: Database,
  brandId: string,
  id: string,
  input: { name?: string; hex?: string | null },
) {
  const updateData = buildPartialUpdate({
    name: input.name,
    hex: input.hex ?? null,
  });

  const [row] = await db
    .update(brandTags)
    .set(updateData)
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
      created_at: brandTags.createdAt,
      updated_at: brandTags.updatedAt,
    });
  return row;
}

export async function deleteBrandTag(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandTags)
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({ id: brandTags.id });
  return row;
}

