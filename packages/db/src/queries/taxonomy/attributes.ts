import { asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { taxonomyAttributes } from "../../schema";

export async function listTaxonomyAttributes(db: Database) {
  return db
    .select({
      id: taxonomyAttributes.id,
      publicId: taxonomyAttributes.publicId,
      friendlyId: taxonomyAttributes.friendlyId,
      name: taxonomyAttributes.name,
      description: taxonomyAttributes.description,
      createdAt: taxonomyAttributes.createdAt,
      updatedAt: taxonomyAttributes.updatedAt,
    })
    .from(taxonomyAttributes)
    .orderBy(asc(taxonomyAttributes.name));
}

export async function getTaxonomyAttributeByFriendlyId(
  db: Database,
  friendlyId: string,
) {
  const [attribute] = await db
    .select({
      id: taxonomyAttributes.id,
      publicId: taxonomyAttributes.publicId,
      friendlyId: taxonomyAttributes.friendlyId,
      name: taxonomyAttributes.name,
      description: taxonomyAttributes.description,
      createdAt: taxonomyAttributes.createdAt,
      updatedAt: taxonomyAttributes.updatedAt,
    })
    .from(taxonomyAttributes)
    .where(eq(taxonomyAttributes.friendlyId, friendlyId))
    .limit(1);

  return attribute ?? null;
}
