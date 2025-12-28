import { asc, eq } from "drizzle-orm";
import type { Database } from "../../client";
import { taxonomyAttributes, taxonomyValues } from "../../schema";

export async function listTaxonomyValues(db: Database) {
  return db
    .select({
      id: taxonomyValues.id,
      publicId: taxonomyValues.publicId,
      publicAttributeId: taxonomyValues.publicAttributeId,
      attributeId: taxonomyValues.attributeId,
      friendlyId: taxonomyValues.friendlyId,
      name: taxonomyValues.name,
      sortOrder: taxonomyValues.sortOrder,
      metadata: taxonomyValues.metadata,
      createdAt: taxonomyValues.createdAt,
      updatedAt: taxonomyValues.updatedAt,
    })
    .from(taxonomyValues)
    .orderBy(asc(taxonomyValues.sortOrder));
}

export async function listTaxonomyValuesByAttribute(
  db: Database,
  attributeFriendlyId: string,
) {
  return db
    .select({
      id: taxonomyValues.id,
      publicId: taxonomyValues.publicId,
      publicAttributeId: taxonomyValues.publicAttributeId,
      attributeId: taxonomyValues.attributeId,
      friendlyId: taxonomyValues.friendlyId,
      name: taxonomyValues.name,
      sortOrder: taxonomyValues.sortOrder,
      metadata: taxonomyValues.metadata,
      createdAt: taxonomyValues.createdAt,
      updatedAt: taxonomyValues.updatedAt,
    })
    .from(taxonomyValues)
    .innerJoin(
      taxonomyAttributes,
      eq(taxonomyValues.attributeId, taxonomyAttributes.id),
    )
    .where(eq(taxonomyAttributes.friendlyId, attributeFriendlyId))
    .orderBy(asc(taxonomyValues.sortOrder));
}

export async function getTaxonomyValueByFriendlyId(
  db: Database,
  friendlyId: string,
) {
  const [value] = await db
    .select({
      id: taxonomyValues.id,
      publicId: taxonomyValues.publicId,
      publicAttributeId: taxonomyValues.publicAttributeId,
      attributeId: taxonomyValues.attributeId,
      friendlyId: taxonomyValues.friendlyId,
      name: taxonomyValues.name,
      sortOrder: taxonomyValues.sortOrder,
      metadata: taxonomyValues.metadata,
      createdAt: taxonomyValues.createdAt,
      updatedAt: taxonomyValues.updatedAt,
    })
    .from(taxonomyValues)
    .where(eq(taxonomyValues.friendlyId, friendlyId))
    .limit(1);

  return value ?? null;
}
