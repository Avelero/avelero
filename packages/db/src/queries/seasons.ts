import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../client";
import { brandSeasons } from "../schema";

/**
 * List all seasons for a brand
 */
export async function listSeasonsForBrand(db: Database, brandId: string) {
  return db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    })
    .from(brandSeasons)
    .where(eq(brandSeasons.brandId, brandId))
    .orderBy(asc(brandSeasons.name));
}

/**
 * Get a season by ID
 */
export async function getSeasonById(
  db: Database,
  brandId: string,
  seasonId: string,
) {
  const [row] = await db
    .select({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    })
    .from(brandSeasons)
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)))
    .limit(1);
  return row;
}

/**
 * Create a new season for a brand
 */
export async function createSeason(
  db: Database,
  brandId: string,
  input: {
    name: string;
    startDate?: Date | null;
    endDate?: Date | null;
    ongoing?: boolean;
  },
) {
  const [row] = await db
    .insert(brandSeasons)
    .values({
      brandId,
      name: input.name,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      ongoing: input.ongoing ?? false,
    })
    .returning({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    });
  return row;
}

/**
 * Update a season
 */
export async function updateSeason(
  db: Database,
  brandId: string,
  seasonId: string,
  input: {
    name?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    ongoing?: boolean;
  },
) {
  const [row] = await db
    .update(brandSeasons)
    .set({
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      ongoing: input.ongoing,
    })
    .where(
      and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)),
    )
    .returning({
      id: brandSeasons.id,
      name: brandSeasons.name,
      startDate: brandSeasons.startDate,
      endDate: brandSeasons.endDate,
      ongoing: brandSeasons.ongoing,
      createdAt: brandSeasons.createdAt,
      updatedAt: brandSeasons.updatedAt,
    });
  return row;
}

/**
 * Delete a season
 */
export async function deleteSeason(
  db: Database,
  brandId: string,
  seasonId: string,
) {
  const [row] = await db
    .delete(brandSeasons)
    .where(
      and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)),
    )
    .returning({ id: brandSeasons.id });
  return row;
}