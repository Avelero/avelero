import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandColors } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listColors(db: Database, brandId: string) {
  return db
    .select({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    })
    .from(brandColors)
    .where(eq(brandColors.brandId, brandId))
    .orderBy(asc(brandColors.name));
}

export async function createColor(
  db: Database,
  brandId: string,
  input: { name: string; hex: string },
) {
  const [row] = await db
    .insert(brandColors)
    .values({ brandId, name: input.name, hex: input.hex })
    .returning({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    });
  return row;
}

export async function updateColor(
  db: Database,
  brandId: string,
  id: string,
  input: { name?: string; hex?: string },
) {
  const updateData = buildPartialUpdate(input);

  const [row] = await db
    .update(brandColors)
    .set(updateData)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
      created_at: brandColors.createdAt,
      updated_at: brandColors.updatedAt,
    });
  return row;
}

export async function deleteColor(db: Database, brandId: string, id: string) {
  const [row] = await db
    .delete(brandColors)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row;
}

