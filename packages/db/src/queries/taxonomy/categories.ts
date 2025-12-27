import { asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { taxonomyCategories } from "../../schema";

export async function listTaxonomyCategories(db: Database) {
  return db
    .select({
      id: taxonomyCategories.id,
      publicId: taxonomyCategories.publicId,
      name: taxonomyCategories.name,
      parentId: taxonomyCategories.parentId,
      createdAt: taxonomyCategories.createdAt,
      updatedAt: taxonomyCategories.updatedAt,
    })
    .from(taxonomyCategories)
    .orderBy(asc(taxonomyCategories.name));
}

export async function getTaxonomyCategoryByPublicId(
  db: Database,
  publicId: string,
) {
  const [category] = await db
    .select({
      id: taxonomyCategories.id,
      publicId: taxonomyCategories.publicId,
      name: taxonomyCategories.name,
      parentId: taxonomyCategories.parentId,
      createdAt: taxonomyCategories.createdAt,
      updatedAt: taxonomyCategories.updatedAt,
    })
    .from(taxonomyCategories)
    .where(eq(taxonomyCategories.publicId, publicId))
    .limit(1);

  return category ?? null;
}
