import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandSizes } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listSizes(db: Database, brandId: string) {
  return db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
      created_at: brandSizes.createdAt,
      updated_at: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(eq(brandSizes.brandId, brandId))
    .orderBy(asc(brandSizes.name));
}

export async function createSize(
  db: Database,
  brandId: string,
  input: {
    name: string;
  },
) {
  const [row] = await db
    .insert(brandSizes)
    .values({
      brandId,
      name: input.name,
    })
    .returning({
      id: brandSizes.id,
      name: brandSizes.name,
    });
  return row;
}

export async function updateSize(
  db: Database,
  brandId: string,
  id: string,
  input: {
    name?: string;
  },
) {
  const updateData = buildPartialUpdate(input);

  const [row] = await db
    .update(brandSizes)
    .set(updateData)
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({
      id: brandSizes.id,
      name: brandSizes.name,
    });
  return row;
}

export async function deleteSize(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandSizes)
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({ id: brandSizes.id });
  return row;
}

