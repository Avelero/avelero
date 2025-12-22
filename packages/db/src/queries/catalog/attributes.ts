/**
 * Brand attributes catalog query functions.
 *
 * CRUD operations for brand-owned variant attributes.
 * Attributes can optionally link to taxonomy attributes for semantic meaning.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { brandAttributes, taxonomyAttributes } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface BrandAttributeData {
  id: string;
  brandId: string;
  taxonomyAttributeId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface BrandAttributeWithTaxonomy extends BrandAttributeData {
  taxonomyAttribute: {
    id: string;
    friendlyId: string;
    name: string;
  } | null;
}

export interface CreateBrandAttributeInput {
  name: string;
  taxonomyAttributeId?: string | null;
}

export interface UpdateBrandAttributeInput {
  name?: string;
  taxonomyAttributeId?: string | null;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get a brand attribute by ID.
 */
export async function getBrandAttribute(
  db: Database,
  attributeId: string
): Promise<BrandAttributeData | null> {
  const [row] = await db
    .select({
      id: brandAttributes.id,
      brandId: brandAttributes.brandId,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      name: brandAttributes.name,
      createdAt: brandAttributes.createdAt,
      updatedAt: brandAttributes.updatedAt,
    })
    .from(brandAttributes)
    .where(eq(brandAttributes.id, attributeId))
    .limit(1);
  return row ?? null;
}

/**
 * List all attributes for a brand.
 */
export async function listBrandAttributes(
  db: Database,
  brandId: string
): Promise<BrandAttributeData[]> {
  return db
    .select({
      id: brandAttributes.id,
      brandId: brandAttributes.brandId,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      name: brandAttributes.name,
      createdAt: brandAttributes.createdAt,
      updatedAt: brandAttributes.updatedAt,
    })
    .from(brandAttributes)
    .where(eq(brandAttributes.brandId, brandId))
    .orderBy(brandAttributes.name);
}

/**
 * List all attributes for a brand with taxonomy details.
 */
export async function listBrandAttributesWithTaxonomy(
  db: Database,
  brandId: string
): Promise<BrandAttributeWithTaxonomy[]> {
  const rows = await db
    .select({
      id: brandAttributes.id,
      brandId: brandAttributes.brandId,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      name: brandAttributes.name,
      createdAt: brandAttributes.createdAt,
      updatedAt: brandAttributes.updatedAt,
      taxonomyId: taxonomyAttributes.id,
      taxonomyFriendlyId: taxonomyAttributes.friendlyId,
      taxonomyName: taxonomyAttributes.name,
    })
    .from(brandAttributes)
    .leftJoin(
      taxonomyAttributes,
      eq(brandAttributes.taxonomyAttributeId, taxonomyAttributes.id)
    )
    .where(eq(brandAttributes.brandId, brandId))
    .orderBy(brandAttributes.name);

  return rows.map((row) => ({
    id: row.id,
    brandId: row.brandId,
    taxonomyAttributeId: row.taxonomyAttributeId,
    name: row.name,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    taxonomyAttribute: row.taxonomyId
      ? {
          id: row.taxonomyId,
          friendlyId: row.taxonomyFriendlyId!,
          name: row.taxonomyName!,
        }
      : null,
  }));
}

/**
 * Create a brand attribute.
 */
export async function createBrandAttribute(
  db: Database,
  brandId: string,
  input: CreateBrandAttributeInput
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(brandAttributes)
    .values({
      brandId,
      name: input.name.trim(),
      taxonomyAttributeId: input.taxonomyAttributeId ?? null,
    })
    .returning({ id: brandAttributes.id });
  return row ?? null;
}

/**
 * Update a brand attribute.
 */
export async function updateBrandAttribute(
  db: Database,
  brandId: string,
  id: string,
  input: UpdateBrandAttributeInput
): Promise<{ id: string } | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.taxonomyAttributeId !== undefined) {
    updateData.taxonomyAttributeId = input.taxonomyAttributeId;
  }

  const [row] = await db
    .update(brandAttributes)
    .set(updateData)
    .where(and(eq(brandAttributes.id, id), eq(brandAttributes.brandId, brandId)))
    .returning({ id: brandAttributes.id });
  return row ?? null;
}

/**
 * Delete a brand attribute.
 */
export async function deleteBrandAttribute(
  db: Database,
  brandId: string,
  id: string
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(brandAttributes)
    .where(and(eq(brandAttributes.id, id), eq(brandAttributes.brandId, brandId)))
    .returning({ id: brandAttributes.id });
  return row ?? null;
}

// =============================================================================
// LOOKUP OPERATIONS
// =============================================================================

/**
 * Find a brand attribute by name (case-insensitive).
 */
export async function findBrandAttributeByName(
  db: Database,
  brandId: string,
  name: string
): Promise<BrandAttributeData | null> {
  const rows = await db
    .select({
      id: brandAttributes.id,
      brandId: brandAttributes.brandId,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      name: brandAttributes.name,
      createdAt: brandAttributes.createdAt,
      updatedAt: brandAttributes.updatedAt,
    })
    .from(brandAttributes)
    .where(eq(brandAttributes.brandId, brandId));

  const normalizedName = name.trim().toLowerCase();
  const match = rows.find((row) => row.name.toLowerCase() === normalizedName);
  return match ?? null;
}

/**
 * Load all attributes for a brand into a Map for O(1) lookup by name.
 * Used for cache pre-warming in sync operations.
 */
export async function loadBrandAttributesMap(
  db: Database,
  brandId: string
): Promise<Map<string, { id: string; taxonomyAttributeId: string | null }>> {
  const rows = await db
    .select({
      id: brandAttributes.id,
      name: brandAttributes.name,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
    })
    .from(brandAttributes)
    .where(eq(brandAttributes.brandId, brandId));

  const map = new Map<string, { id: string; taxonomyAttributeId: string | null }>();
  for (const row of rows) {
    map.set(row.name.toLowerCase(), {
      id: row.id,
      taxonomyAttributeId: row.taxonomyAttributeId,
    });
  }
  return map;
}

/**
 * Get brand attributes by IDs.
 */
export async function getBrandAttributesByIds(
  db: Database,
  attributeIds: string[]
): Promise<BrandAttributeData[]> {
  if (attributeIds.length === 0) return [];

  return db
    .select({
      id: brandAttributes.id,
      brandId: brandAttributes.brandId,
      taxonomyAttributeId: brandAttributes.taxonomyAttributeId,
      name: brandAttributes.name,
      createdAt: brandAttributes.createdAt,
      updatedAt: brandAttributes.updatedAt,
    })
    .from(brandAttributes)
    .where(inArray(brandAttributes.id, attributeIds));
}

// =============================================================================
// BATCH OPERATIONS (for sync engine)
// =============================================================================

/**
 * Batch create multiple brand attributes in a single query.
 * Uses ON CONFLICT DO NOTHING to handle existing attributes.
 * Returns a map of attribute name (lowercase) -> attribute ID for all attributes.
 */
export async function batchCreateBrandAttributes(
  db: Database,
  brandId: string,
  names: string[]
): Promise<Map<string, string>> {
  if (names.length === 0) return new Map();

  // Deduplicate and normalize names
  const uniqueNames = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))];
  if (uniqueNames.length === 0) return new Map();

  // Insert with ON CONFLICT DO NOTHING
  await db
    .insert(brandAttributes)
    .values(uniqueNames.map((name) => ({ brandId, name })))
    .onConflictDoNothing();

  // Load all attributes back to get IDs (including any that already existed)
  return loadBrandAttributesMap(db, brandId).then((m) => {
    const result = new Map<string, string>();
    for (const [key, val] of m) {
      result.set(key, val.id);
    }
    return result;
  });
}

/**
 * Ensure a brand attribute exists for the given taxonomy attribute.
 * Creates the brand attribute if it doesn't exist.
 * Returns the brand attribute ID.
 */
export async function ensureBrandAttributeForTaxonomy(
  db: Database,
  brandId: string,
  taxonomyAttributeId: string,
  taxonomyAttributeName: string
): Promise<string> {
  // Check if brand already has an attribute linked to this taxonomy attribute
  const [existing] = await db
    .select({ id: brandAttributes.id })
    .from(brandAttributes)
    .where(
      and(
        eq(brandAttributes.brandId, brandId),
        eq(brandAttributes.taxonomyAttributeId, taxonomyAttributeId)
      )
    )
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Create new brand attribute linked to taxonomy
  const [created] = await db
    .insert(brandAttributes)
    .values({
      brandId,
      taxonomyAttributeId,
      name: taxonomyAttributeName,
    })
    .returning({ id: brandAttributes.id });

  return created!.id;
}

