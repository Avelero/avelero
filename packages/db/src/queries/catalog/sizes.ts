/**
 * Size catalog query functions.
 *
 * CRUD operations for brand-owned sizes.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { brandSizes } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface SizeData {
  id: string;
  brandId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSizeInput {
  name: string;
}

export interface UpdateSizeInput {
  name?: string;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get a size by ID.
 */
export async function getSize(
  db: Database,
  sizeId: string
): Promise<SizeData | null> {
  const [row] = await db
    .select({
      id: brandSizes.id,
      brandId: brandSizes.brandId,
      name: brandSizes.name,
      createdAt: brandSizes.createdAt,
      updatedAt: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(eq(brandSizes.id, sizeId))
    .limit(1);
  return row ?? null;
}

/**
 * List all sizes for a brand.
 */
export async function listSizes(
  db: Database,
  brandId: string
): Promise<SizeData[]> {
  return db
    .select({
      id: brandSizes.id,
      brandId: brandSizes.brandId,
      name: brandSizes.name,
      createdAt: brandSizes.createdAt,
      updatedAt: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(eq(brandSizes.brandId, brandId))
    .orderBy(brandSizes.name);
}

/**
 * Create a size.
 */
export async function createSize(
  db: Database,
  brandId: string,
  input: CreateSizeInput
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(brandSizes)
    .values({
      brandId,
      name: input.name.trim(),
    })
    .returning({ id: brandSizes.id });
  return row ?? null;
}

/**
 * Update a size.
 */
export async function updateSize(
  db: Database,
  brandId: string,
  id: string,
  input: UpdateSizeInput
): Promise<{ id: string } | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }

  const [row] = await db
    .update(brandSizes)
    .set(updateData)
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({ id: brandSizes.id });
  return row ?? null;
}

/**
 * Delete a size.
 */
export async function deleteSize(
  db: Database,
  brandId: string,
  id: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(brandSizes)
    .where(and(eq(brandSizes.id, id), eq(brandSizes.brandId, brandId)))
    .returning({ id: brandSizes.id });
  return row ?? null;
}

// NOTE: findSizeByName is exported from integrations/links/entity-links.ts
// to avoid duplicate exports, use that version instead

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Load all sizes for a brand into a Map for O(1) lookup by name.
 * Used for cache pre-warming in sync operations.
 */
export async function loadSizesMap(
  db: Database,
  brandId: string
): Promise<Map<string, string>> {
  const rows = await db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
    })
    .from(brandSizes)
    .where(eq(brandSizes.brandId, brandId));

  const map = new Map<string, string>();
  for (const row of rows) {
    // Store by lowercase name for case-insensitive lookup
    map.set(row.name.toLowerCase(), row.id);
  }
  return map;
}

/**
 * Batch create sizes.
 * Creates multiple sizes at once, skipping duplicates.
 * Uses ON CONFLICT DO NOTHING for efficiency.
 *
 * @param sizes - Array of { name } to create
 * @returns Map of lowercase name -> id for created sizes
 */
export async function batchCreateSizes(
  db: Database,
  brandId: string,
  sizes: Array<{ name: string }>
): Promise<Map<string, string>> {
  if (sizes.length === 0) {
    return new Map();
  }

  // Deduplicate by lowercase name
  const uniqueSizes = new Map<string, string>();
  for (const size of sizes) {
    const key = size.name.trim().toLowerCase();
    if (!uniqueSizes.has(key)) {
      uniqueSizes.set(key, size.name.trim());
    }
  }

  // Insert with ON CONFLICT DO NOTHING
  await db
    .insert(brandSizes)
    .values(
      Array.from(uniqueSizes.values()).map((name) => ({
        brandId,
        name,
      }))
    )
    .onConflictDoNothing({
      target: [brandSizes.brandId, brandSizes.name],
    });

  // Fetch all sizes (including ones that already existed)
  const names = Array.from(uniqueSizes.values());
  const rows = await db
    .select({
      id: brandSizes.id,
      name: brandSizes.name,
    })
    .from(brandSizes)
    .where(and(eq(brandSizes.brandId, brandId), inArray(brandSizes.name, names)));

  const result = new Map<string, string>();
  for (const row of rows) {
    result.set(row.name.toLowerCase(), row.id);
  }
  return result;
}

/**
 * Get sizes by IDs.
 */
export async function getSizesByIds(
  db: Database,
  sizeIds: string[]
): Promise<SizeData[]> {
  if (sizeIds.length === 0) return [];

  return db
    .select({
      id: brandSizes.id,
      brandId: brandSizes.brandId,
      name: brandSizes.name,
      createdAt: brandSizes.createdAt,
      updatedAt: brandSizes.updatedAt,
    })
    .from(brandSizes)
    .where(inArray(brandSizes.id, sizeIds));
}
