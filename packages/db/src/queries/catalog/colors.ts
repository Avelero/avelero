/**
 * Color catalog query functions.
 *
 * CRUD operations for brand-owned colors.
 */

import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../client";
import { brandColors } from "../../schema";

// =============================================================================
// TYPES
// =============================================================================

export interface ColorData {
  id: string;
  brandId: string;
  name: string;
  hex: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateColorInput {
  name: string;
  hex?: string;
}

export interface UpdateColorInput {
  name?: string;
  hex?: string;
}

// =============================================================================
// CRUD OPERATIONS
// =============================================================================

/**
 * Get a color by ID.
 */
export async function getColor(
  db: Database,
  colorId: string
): Promise<ColorData | null> {
  const [row] = await db
    .select({
      id: brandColors.id,
      brandId: brandColors.brandId,
      name: brandColors.name,
      hex: brandColors.hex,
      createdAt: brandColors.createdAt,
      updatedAt: brandColors.updatedAt,
    })
    .from(brandColors)
    .where(eq(brandColors.id, colorId))
    .limit(1);
  return row ?? null;
}

/**
 * List all colors for a brand.
 */
export async function listColors(
  db: Database,
  brandId: string
): Promise<ColorData[]> {
  return db
    .select({
      id: brandColors.id,
      brandId: brandColors.brandId,
      name: brandColors.name,
      hex: brandColors.hex,
      createdAt: brandColors.createdAt,
      updatedAt: brandColors.updatedAt,
    })
    .from(brandColors)
    .where(eq(brandColors.brandId, brandId))
    .orderBy(brandColors.name);
}

/**
 * Create a color.
 */
export async function createColor(
  db: Database,
  brandId: string,
  input: CreateColorInput
): Promise<{ id: string } | null> {
  const [row] = await db
    .insert(brandColors)
    .values({
      brandId,
      name: input.name.trim(),
      hex: input.hex ?? null,
    })
    .returning({ id: brandColors.id });
  return row ?? null;
}

/**
 * Update a color.
 */
export async function updateColor(
  db: Database,
  brandId: string,
  id: string,
  input: UpdateColorInput
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
    .update(brandColors)
    .set(updateData)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row ?? null;
}

/**
 * Delete a color.
 */
export async function deleteColor(
  db: Database,
  brandId: string,
  id: string,
): Promise<{ id: string } | null> {
  const [row] = await db
    .delete(brandColors)
    .where(and(eq(brandColors.id, id), eq(brandColors.brandId, brandId)))
    .returning({ id: brandColors.id });
  return row ?? null;
}

// NOTE: findColorByName is exported from integrations/links/entity-links.ts
// to avoid duplicate exports, use that version instead

// =============================================================================
// BATCH OPERATIONS
// =============================================================================

/**
 * Load all colors for a brand into a Map for O(1) lookup by name.
 * Used for cache pre-warming in sync operations.
 */
export async function loadColorsMap(
  db: Database,
  brandId: string
): Promise<Map<string, { id: string; hex: string | null }>> {
  const rows = await db
    .select({
      id: brandColors.id,
      name: brandColors.name,
      hex: brandColors.hex,
    })
    .from(brandColors)
    .where(eq(brandColors.brandId, brandId));

  const map = new Map<string, { id: string; hex: string | null }>();
  for (const row of rows) {
    // Store by lowercase name for case-insensitive lookup
    map.set(row.name.toLowerCase(), { id: row.id, hex: row.hex });
  }
  return map;
}

/**
 * Batch create colors.
 * Creates multiple colors at once, skipping duplicates.
 * Uses ON CONFLICT DO NOTHING for efficiency.
 *
 * @param colors - Array of { name, hex? } to create
 * @returns Map of lowercase name -> id for created colors
 */
export async function batchCreateColors(
  db: Database,
  brandId: string,
  colors: Array<{ name: string; hex?: string | null }>
): Promise<Map<string, string>> {
  if (colors.length === 0) {
    return new Map();
  }

  // Deduplicate by lowercase name
  const uniqueColors = new Map<string, { name: string; hex: string | null }>();
  for (const color of colors) {
    const key = color.name.trim().toLowerCase();
    if (!uniqueColors.has(key)) {
      uniqueColors.set(key, {
        name: color.name.trim(),
        hex: color.hex ?? null,
      });
    }
  }

  // Insert with ON CONFLICT DO NOTHING
  await db
    .insert(brandColors)
    .values(
      Array.from(uniqueColors.values()).map((c) => ({
        brandId,
        name: c.name,
        hex: c.hex,
      }))
    )
    .onConflictDoNothing({
      target: [brandColors.brandId, brandColors.name],
    });

  // Fetch all colors (including ones that already existed)
  const names = Array.from(uniqueColors.values()).map((c) => c.name);
  const rows = await db
    .select({
      id: brandColors.id,
      name: brandColors.name,
    })
    .from(brandColors)
    .where(
      and(eq(brandColors.brandId, brandId), inArray(brandColors.name, names))
    );

  const result = new Map<string, string>();
  for (const row of rows) {
    result.set(row.name.toLowerCase(), row.id);
  }
  return result;
}

/**
 * Get colors by IDs.
 */
export async function getColorsByIds(
  db: Database,
  colorIds: string[]
): Promise<ColorData[]> {
  if (colorIds.length === 0) return [];

  return db
    .select({
      id: brandColors.id,
      brandId: brandColors.brandId,
      name: brandColors.name,
      hex: brandColors.hex,
      createdAt: brandColors.createdAt,
      updatedAt: brandColors.updatedAt,
    })
    .from(brandColors)
    .where(inArray(brandColors.id, colorIds));
}
