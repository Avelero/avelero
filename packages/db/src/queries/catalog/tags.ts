/**
 * Tag catalog query functions.
 *
 * CRUD operations for brand-owned tags.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { brandTags } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface TagData {
  id: string;
  brandId: string;
  name: string;
  hex: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTagInput {
  name: string;
  hex?: string | null;
}

export interface UpdateTagInput {
  name?: string;
  hex?: string | null;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get a tag by ID.
 */
export async function getBrandTag(
  db: Database,
  tagId: string,
): Promise<TagData | null> {
  const [row] = await db
    .select({
      id: brandTags.id,
      brandId: brandTags.brandId,
      name: brandTags.name,
      hex: brandTags.hex,
      createdAt: brandTags.createdAt,
      updatedAt: brandTags.updatedAt,
    })
    .from(brandTags)
    .where(eq(brandTags.id, tagId))
    .limit(1);
  return row ?? null;
}

/**
 * List all tags for a brand.
 */
export async function listBrandTags(
  db: Database,
  brandId: string,
): Promise<TagData[]> {
  return db
    .select({
      id: brandTags.id,
      brandId: brandTags.brandId,
      name: brandTags.name,
      hex: brandTags.hex,
      createdAt: brandTags.createdAt,
      updatedAt: brandTags.updatedAt,
    })
    .from(brandTags)
    .where(eq(brandTags.brandId, brandId))
    .orderBy(brandTags.name);
}

/**
 * Create a tag.
 */
export async function createBrandTag(
  db: Database,
  brandId: string,
  input: CreateTagInput,
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(brandTags)
    .values({
      brandId,
      name: input.name.trim(),
      hex: input.hex ?? null,
    })
    .returning({ id: brandTags.id });
  return row ?? null;
}

/**
 * Update a tag.
 */
export async function updateBrandTag(
  db: Database,
  brandId: string,
  id: string,
  input: UpdateTagInput,
): Promise<{ id: string } | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date().toISOString(),
  };
  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.hex !== undefined) {
    updateData.hex = input.hex;
  }

  const [row] = await db
    .update(brandTags)
    .set(updateData)
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({ id: brandTags.id });
  return row ?? null;
}

/**
 * Delete a tag.
 */
export async function deleteBrandTag(
  db: Database,
  brandId: string,
  id: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(brandTags)
    .where(and(eq(brandTags.id, id), eq(brandTags.brandId, brandId)))
    .returning({ id: brandTags.id });
  return row ?? null;
}

// NOTE: findTagByName is exported from integrations/links/entity-links.ts
// to avoid duplicate exports, use that version instead

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Load all tags for a brand into a Map for O(1) lookup by name.
 * Used for cache pre-warming in sync operations.
 */
export async function loadTagsMap(
  db: Database,
  brandId: string,
): Promise<Map<string, { id: string; hex: string | null }>> {
  const rows = await db
    .select({
      id: brandTags.id,
      name: brandTags.name,
      hex: brandTags.hex,
    })
    .from(brandTags)
    .where(eq(brandTags.brandId, brandId));

  const map = new Map<string, { id: string; hex: string | null }>();
  for (const row of rows) {
    // Store by lowercase name for case-insensitive lookup
    map.set(row.name.toLowerCase(), { id: row.id, hex: row.hex });
  }
  return map;
}

/**
 * Batch create tags.
 * Creates multiple tags at once, skipping duplicates.
 * Uses ON CONFLICT DO NOTHING for efficiency.
 *
 * @param tags - Array of { name, hex? } to create
 * @returns Map of lowercase name -> id for created tags
 */
export async function batchCreateTags(
  db: Database,
  brandId: string,
  tags: Array<{ name: string; hex?: string | null }>,
): Promise<Map<string, string>> {
  if (tags.length === 0) {
    return new Map();
  }

  // Deduplicate by lowercase name
  const uniqueTags = new Map<string, { name: string; hex: string | null }>();
  for (const tag of tags) {
    const key = tag.name.trim().toLowerCase();
    if (!uniqueTags.has(key)) {
      uniqueTags.set(key, {
        name: tag.name.trim(),
        hex: tag.hex ?? null,
      });
    }
  }

  // Insert with ON CONFLICT DO NOTHING
  await db
    .insert(brandTags)
    .values(
      Array.from(uniqueTags.values()).map((t) => ({
        brandId,
        name: t.name,
        hex: t.hex,
      })),
    )
    .onConflictDoNothing({
      target: [brandTags.brandId, brandTags.name],
    });

  // Fetch all tags (including ones that already existed)
  const names = Array.from(uniqueTags.values()).map((t) => t.name);
  const rows = await db
    .select({
      id: brandTags.id,
      name: brandTags.name,
    })
    .from(brandTags)
    .where(and(eq(brandTags.brandId, brandId), inArray(brandTags.name, names)));

  const result = new Map<string, string>();
  for (const row of rows) {
    result.set(row.name.toLowerCase(), row.id);
  }
  return result;
}

/**
 * Get tags by IDs.
 */
export async function getTagsByIds(
  db: Database,
  tagIds: string[],
): Promise<TagData[]> {
  if (tagIds.length === 0) return [];

  return db
    .select({
      id: brandTags.id,
      brandId: brandTags.brandId,
      name: brandTags.name,
      hex: brandTags.hex,
      createdAt: brandTags.createdAt,
      updatedAt: brandTags.updatedAt,
    })
    .from(brandTags)
    .where(inArray(brandTags.id, tagIds));
}

// NOTE: setProductTags is exported from products/attributes.ts
// Product-tag relation functions are in products/attributes.ts
