/**
 * Brand attribute values catalog query functions.
 *
 * CRUD operations for brand-owned attribute values.
 * Values belong to a brand attribute and can optionally link to taxonomy values.
 */

import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../../client";
import {
  brandAttributeValues,
  brandAttributes,
  productVariantAttributes,
} from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface BrandAttributeValueData {
  id: string;
  brandId: string;
  attributeId: string;
  taxonomyValueId: string | null;
  name: string;
  metadata: unknown;
  sortOrder: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBrandAttributeValueInput {
  attributeId: string;
  name: string;
  taxonomyValueId?: string | null;
  metadata?: unknown;
}

export interface UpdateBrandAttributeValueInput {
  name?: string;
  taxonomyValueId?: string | null;
  metadata?: unknown;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get a brand attribute value by ID.
 */
export async function getBrandAttributeValue(
  db: Database,
  valueId: string,
): Promise<BrandAttributeValueData | null> {
  const [row] = await db
    .select({
      id: brandAttributeValues.id,
      brandId: brandAttributeValues.brandId,
      attributeId: brandAttributeValues.attributeId,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
      name: brandAttributeValues.name,
      metadata: brandAttributeValues.metadata,
      sortOrder: brandAttributeValues.sortOrder,
      createdAt: brandAttributeValues.createdAt,
      updatedAt: brandAttributeValues.updatedAt,
    })
    .from(brandAttributeValues)
    .where(eq(brandAttributeValues.id, valueId))
    .limit(1);
  return row ?? null;
}

/**
 * List all values for a brand attribute.
 */
export async function listBrandAttributeValues(
  db: Database,
  brandId: string,
  attributeId: string,
): Promise<BrandAttributeValueData[]> {
  return db
    .select({
      id: brandAttributeValues.id,
      brandId: brandAttributeValues.brandId,
      attributeId: brandAttributeValues.attributeId,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
      name: brandAttributeValues.name,
      metadata: brandAttributeValues.metadata,
      sortOrder: brandAttributeValues.sortOrder,
      createdAt: brandAttributeValues.createdAt,
      updatedAt: brandAttributeValues.updatedAt,
    })
    .from(brandAttributeValues)
    .where(
      and(
        eq(brandAttributeValues.brandId, brandId),
        eq(brandAttributeValues.attributeId, attributeId),
      ),
    )
    .orderBy(
      sql`${brandAttributeValues.sortOrder} nulls last`,
      asc(brandAttributeValues.name),
    );
}

/**
 * List all values for all attributes of a brand.
 */
export async function listAllBrandAttributeValues(
  db: Database,
  brandId: string,
): Promise<BrandAttributeValueData[]> {
  return db
    .select({
      id: brandAttributeValues.id,
      brandId: brandAttributeValues.brandId,
      attributeId: brandAttributeValues.attributeId,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
      name: brandAttributeValues.name,
      metadata: brandAttributeValues.metadata,
      sortOrder: brandAttributeValues.sortOrder,
      createdAt: brandAttributeValues.createdAt,
      updatedAt: brandAttributeValues.updatedAt,
    })
    .from(brandAttributeValues)
    .where(eq(brandAttributeValues.brandId, brandId))
    .orderBy(
      asc(brandAttributeValues.attributeId),
      sql`${brandAttributeValues.sortOrder} nulls last`,
      asc(brandAttributeValues.name),
    );
}

/**
 * Create a brand attribute value.
 */
export async function createBrandAttributeValue(
  db: Database,
  brandId: string,
  input: CreateBrandAttributeValueInput,
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(brandAttributeValues)
    .values({
      brandId,
      attributeId: input.attributeId,
      name: input.name.trim(),
      taxonomyValueId: input.taxonomyValueId ?? null,
      metadata: input.metadata ?? {},
    })
    .returning({ id: brandAttributeValues.id });
  return row ?? null;
}

/**
 * Update a brand attribute value.
 */
export async function updateBrandAttributeValue(
  db: Database,
  brandId: string,
  id: string,
  input: UpdateBrandAttributeValueInput,
): Promise<{ id: string } | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.taxonomyValueId !== undefined) {
    updateData.taxonomyValueId = input.taxonomyValueId;
  }
  if (input.metadata !== undefined) {
    updateData.metadata = input.metadata;
  }

  const [row] = await db
    .update(brandAttributeValues)
    .set(updateData)
    .where(
      and(
        eq(brandAttributeValues.id, id),
        eq(brandAttributeValues.brandId, brandId),
      ),
    )
    .returning({ id: brandAttributeValues.id });
  return row ?? null;
}

/**
 * Delete a brand attribute value.
 */
export async function deleteBrandAttributeValue(
  db: Database,
  brandId: string,
  id: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(brandAttributeValues)
    .where(
      and(
        eq(brandAttributeValues.id, id),
        eq(brandAttributeValues.brandId, brandId),
      ),
    )
    .returning({ id: brandAttributeValues.id });
  return row ?? null;
}

/**
 * Count distinct variant references for a single brand attribute value.
 */
export async function countBrandAttributeValueVariantReferences(
  db: Database,
  brandId: string,
  valueId: string,
): Promise<number> {
  const [row] = await db
    .select({
      count:
        sql<number>`count(distinct ${productVariantAttributes.variantId})::int`,
    })
    .from(brandAttributeValues)
    .leftJoin(
      productVariantAttributes,
      eq(productVariantAttributes.attributeValueId, brandAttributeValues.id),
    )
    .where(
      and(
        eq(brandAttributeValues.id, valueId),
        eq(brandAttributeValues.brandId, brandId),
      ),
    );

  return row?.count ?? 0;
}

// =============================================================================
// LOOKUP OPERATIONS
// =============================================================================

/**
 * Find a brand attribute value by name within an attribute (case-insensitive).
 */
export async function findBrandAttributeValueByName(
  db: Database,
  brandId: string,
  attributeId: string,
  name: string,
): Promise<BrandAttributeValueData | null> {
  const rows = await db
    .select({
      id: brandAttributeValues.id,
      brandId: brandAttributeValues.brandId,
      attributeId: brandAttributeValues.attributeId,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
      name: brandAttributeValues.name,
      metadata: brandAttributeValues.metadata,
      sortOrder: brandAttributeValues.sortOrder,
      createdAt: brandAttributeValues.createdAt,
      updatedAt: brandAttributeValues.updatedAt,
    })
    .from(brandAttributeValues)
    .where(
      and(
        eq(brandAttributeValues.brandId, brandId),
        eq(brandAttributeValues.attributeId, attributeId),
      ),
    );

  const normalizedName = name.trim().toLowerCase();
  const match = rows.find((row) => row.name.toLowerCase() === normalizedName);
  return match ?? null;
}

/**
 * Load all attribute values for a brand attribute into a Map for O(1) lookup by name.
 */
export async function loadBrandAttributeValuesMap(
  db: Database,
  brandId: string,
  attributeId: string,
): Promise<Map<string, { id: string; taxonomyValueId: string | null }>> {
  const rows = await db
    .select({
      id: brandAttributeValues.id,
      name: brandAttributeValues.name,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
    })
    .from(brandAttributeValues)
    .where(
      and(
        eq(brandAttributeValues.brandId, brandId),
        eq(brandAttributeValues.attributeId, attributeId),
      ),
    );

  const map = new Map<string, { id: string; taxonomyValueId: string | null }>();
  for (const row of rows) {
    map.set(row.name.toLowerCase(), {
      id: row.id,
      taxonomyValueId: row.taxonomyValueId,
    });
  }
  return map;
}

/**
 * Get brand attribute values by IDs.
 */
export async function getBrandAttributeValuesByIds(
  db: Database,
  valueIds: string[],
): Promise<BrandAttributeValueData[]> {
  if (valueIds.length === 0) return [];

  return db
    .select({
      id: brandAttributeValues.id,
      brandId: brandAttributeValues.brandId,
      attributeId: brandAttributeValues.attributeId,
      taxonomyValueId: brandAttributeValues.taxonomyValueId,
      name: brandAttributeValues.name,
      metadata: brandAttributeValues.metadata,
      sortOrder: brandAttributeValues.sortOrder,
      createdAt: brandAttributeValues.createdAt,
      updatedAt: brandAttributeValues.updatedAt,
    })
    .from(brandAttributeValues)
    .where(inArray(brandAttributeValues.id, valueIds));
}

/**
 * Get brand attribute values with their parent attribute info.
 * Useful for displaying variant attributes with their dimension names.
 */
export async function getBrandAttributeValuesWithAttribute(
  db: Database,
  valueIds: string[],
): Promise<
  Array<{
    id: string;
    name: string;
    attributeId: string;
    attributeName: string;
  }>
> {
  if (valueIds.length === 0) return [];

  return db
    .select({
      id: brandAttributeValues.id,
      name: brandAttributeValues.name,
      attributeId: brandAttributeValues.attributeId,
      attributeName: brandAttributes.name,
    })
    .from(brandAttributeValues)
    .innerJoin(
      brandAttributes,
      eq(brandAttributeValues.attributeId, brandAttributes.id),
    )
    .where(inArray(brandAttributeValues.id, valueIds));
}

// =============================================================================
// BATCH OPERATIONS (for sync engine)
// =============================================================================

/**
 * Load all attribute values for a brand into a nested Map for O(1) lookup.
 * Outer key: attributeId, Inner key: value name (lowercase) -> value ID
 * Used for cache pre-warming in sync operations.
 */
export async function loadAllBrandAttributeValuesMap(
  db: Database,
  brandId: string,
): Promise<Map<string, Map<string, string>>> {
  const rows = await db
    .select({
      id: brandAttributeValues.id,
      attributeId: brandAttributeValues.attributeId,
      name: brandAttributeValues.name,
    })
    .from(brandAttributeValues)
    .where(eq(brandAttributeValues.brandId, brandId));

  const map = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (!map.has(row.attributeId)) {
      map.set(row.attributeId, new Map());
    }
    map.get(row.attributeId)!.set(row.name.toLowerCase(), row.id);
  }
  return map;
}

/**
 * Batch create multiple brand attribute values in a single query.
 * Uses ON CONFLICT DO UPDATE to refresh `updatedAt` for existing values.
 *
 * @param db - Database connection
 * @param brandId - Brand ID
 * @param values - Array of { attributeId, name } pairs to create
 * @returns Map of (attributeId + ":" + nameLower) -> value ID
 */
export async function batchCreateBrandAttributeValues(
  db: Database,
  brandId: string,
  values: Array<{
    attributeId: string;
    name: string;
    taxonomyValueId?: string | null;
  }>,
): Promise<Map<string, string>> {
  if (values.length === 0) return new Map();

  // Deduplicate by (attributeId, name)
  const seen = new Set<string>();
  const uniqueValues: Array<{
    attributeId: string;
    name: string;
    taxonomyValueId?: string | null;
  }> = [];
  for (const v of values) {
    const key = `${v.attributeId}:${v.name.trim().toLowerCase()}`;
    if (!seen.has(key) && v.name.trim().length > 0) {
      seen.add(key);
      uniqueValues.push({
        attributeId: v.attributeId,
        name: v.name.trim(),
        taxonomyValueId: v.taxonomyValueId ?? null,
      });
    }
  }

  if (uniqueValues.length === 0) return new Map();

  // Insert with ON CONFLICT DO UPDATE to keep inserts idempotent.
  await db
    .insert(brandAttributeValues)
    .values(
      uniqueValues.map((v) => ({
        brandId,
        attributeId: v.attributeId,
        name: v.name,
        taxonomyValueId: v.taxonomyValueId ?? null,
      })),
    )
    .onConflictDoUpdate({
      target: [
        brandAttributeValues.brandId,
        brandAttributeValues.attributeId,
        brandAttributeValues.name,
      ],
      set: {
        updatedAt: new Date().toISOString(),
      },
    });

  // Load all values back to get IDs (including any that already existed)
  const allValues = await loadAllBrandAttributeValuesMap(db, brandId);

  // Flatten to single Map with composite key
  const result = new Map<string, string>();
  for (const [attrId, valuesMap] of allValues) {
    for (const [nameLower, valueId] of valuesMap) {
      result.set(`${attrId}:${nameLower}`, valueId);
    }
  }
  return result;
}
