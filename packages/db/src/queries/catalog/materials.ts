import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandMaterials } from "../../schema";
import { buildPartialUpdate } from "../_shared/patch.js";

export async function listMaterials(db: Database, brandId: string) {
  return db
    .select({
      id: brandMaterials.id,
      name: brandMaterials.name,
      certification_id: brandMaterials.certificationId,
      recyclable: brandMaterials.recyclable,
      country_of_origin: brandMaterials.countryOfOrigin,
      created_at: brandMaterials.createdAt,
      updated_at: brandMaterials.updatedAt,
    })
    .from(brandMaterials)
    .where(eq(brandMaterials.brandId, brandId))
    .orderBy(asc(brandMaterials.name));
}

export async function createMaterial(
  db: Database,
  brandId: string,
  input: {
    name: string;
    certificationId?: string;
    recyclable?: boolean;
    countryOfOrigin?: string;
  },
) {
  const [row] = await db
    .insert(brandMaterials)
    .values({
      brandId,
      name: input.name,
      certificationId: input.certificationId ?? null,
      recyclable: input.recyclable ?? null,
      countryOfOrigin: input.countryOfOrigin ?? null,
    })
    .returning({ id: brandMaterials.id });
  return row;
}

export async function updateMaterial(
  db: Database,
  brandId: string,
  id: string,
  input: {
    name?: string;
    certificationId?: string | null;
    recyclable?: boolean | null;
    countryOfOrigin?: string | null;
  },
) {
  const updateData = buildPartialUpdate({
    name: input.name,
    certificationId: input.certificationId ?? null,
    recyclable: input.recyclable ?? null,
    countryOfOrigin: input.countryOfOrigin ?? null,
  });

  const [row] = await db
    .update(brandMaterials)
    .set(updateData)
    .where(and(eq(brandMaterials.id, id), eq(brandMaterials.brandId, brandId)))
    .returning({ id: brandMaterials.id });
  return row;
}

export async function deleteMaterial(
  db: Database,
  brandId: string,
  id: string,
) {
  const [row] = await db
    .delete(brandMaterials)
    .where(and(eq(brandMaterials.id, id), eq(brandMaterials.brandId, brandId)))
    .returning({ id: brandMaterials.id });
  return row;
}





