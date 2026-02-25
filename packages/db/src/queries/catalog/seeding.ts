import { asc, eq } from "drizzle-orm";
import type { DatabaseOrTransaction } from "../../client";
import {
  brandAttributeValues,
  brandAttributes,
  taxonomyAttributes,
  taxonomyValues,
} from "../../schema";

export interface SeedBrandCatalogDefaultsResult {
  attributesCreated: number;
  valuesCreated: number;
}

/**
 * Seeds brand-owned attributes and values from the global taxonomy.
 *
 * This is idempotent for a given brand and is intended for brand creation.
 * Taxonomy FK links are preserved as passive provenance and brand values receive
 * copied metadata/sort order so UI rendering does not require taxonomy joins.
 */
export async function seedBrandCatalogDefaults(
  db: DatabaseOrTransaction,
  brandId: string,
): Promise<SeedBrandCatalogDefaultsResult> {
  const taxAttrs = await db
    .select({
      id: taxonomyAttributes.id,
      name: taxonomyAttributes.name,
    })
    .from(taxonomyAttributes)
    .orderBy(asc(taxonomyAttributes.name));

  if (taxAttrs.length === 0) {
    return { attributesCreated: 0, valuesCreated: 0 };
  }

  const insertedAttrs = await db
    .insert(brandAttributes)
    .values(
      taxAttrs.map((attr) => ({
        brandId,
        name: attr.name,
        taxonomyAttributeId: attr.id,
      })),
    )
    .onConflictDoNothing()
    .returning({ id: brandAttributes.id });

  const brandAttrs = await db
    .select({
      id: brandAttributes.id,
      name: brandAttributes.name,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
    })
    .from(brandAttributes)
    .where(eq(brandAttributes.brandId, brandId));

  const brandAttrByTaxonomyId = new Map<string, string>();
  for (const row of brandAttrs) {
    if (row.taxonomyAttributeId) {
      brandAttrByTaxonomyId.set(row.taxonomyAttributeId, row.id);
    }
  }

  // Fallback by name to keep seeding idempotent if a row exists without taxonomy FK.
  for (const taxAttr of taxAttrs) {
    if (brandAttrByTaxonomyId.has(taxAttr.id)) continue;
    const byName = brandAttrs.find(
      (row) => row.name.toLowerCase() === taxAttr.name.toLowerCase(),
    );
    if (byName) {
      brandAttrByTaxonomyId.set(taxAttr.id, byName.id);
    }
  }

  const taxVals = await db
    .select({
      id: taxonomyValues.id,
      attributeId: taxonomyValues.attributeId,
      name: taxonomyValues.name,
      sortOrder: taxonomyValues.sortOrder,
      metadata: taxonomyValues.metadata,
    })
    .from(taxonomyValues)
    .orderBy(
      asc(taxonomyValues.attributeId),
      asc(taxonomyValues.sortOrder),
      asc(taxonomyValues.name),
    );

  if (taxVals.length === 0) {
    return {
      attributesCreated: insertedAttrs.length,
      valuesCreated: 0,
    };
  }

  const existingValues = await db
    .select({
      attributeId: brandAttributeValues.attributeId,
      name: brandAttributeValues.name,
    })
    .from(brandAttributeValues)
    .where(eq(brandAttributeValues.brandId, brandId));

  const existingValueKeys = new Set(
    existingValues.map(
      (row) => `${row.attributeId}:${row.name.trim().toLowerCase()}`,
    ),
  );

  const valuesToInsert: Array<{
    brandId: string;
    attributeId: string;
    taxonomyValueId: string;
    name: string;
    metadata: unknown;
    sortOrder: number;
  }> = [];

  for (const taxVal of taxVals) {
    const brandAttributeId = brandAttrByTaxonomyId.get(taxVal.attributeId);
    if (!brandAttributeId) continue;

    const key = `${brandAttributeId}:${taxVal.name.trim().toLowerCase()}`;
    if (existingValueKeys.has(key)) continue;

    valuesToInsert.push({
      brandId,
      attributeId: brandAttributeId,
      taxonomyValueId: taxVal.id,
      name: taxVal.name,
      metadata: taxVal.metadata ?? {},
      sortOrder: taxVal.sortOrder,
    });
  }

  let valuesCreated = 0;
  if (valuesToInsert.length > 0) {
    const insertedValues = await db
      .insert(brandAttributeValues)
      .values(valuesToInsert)
      .onConflictDoNothing()
      .returning({ id: brandAttributeValues.id });
    valuesCreated = insertedValues.length;
  }

  return {
    attributesCreated: insertedAttrs.length,
    valuesCreated,
  };
}
