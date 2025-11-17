/**
 * Brand seasons query functions.
 *
 * Provides CRUD operations for brand seasons catalog.
 */
import { and, eq } from "drizzle-orm";
import type { Database } from "../client";
import { brandSeasons } from "../schema";

export interface SeasonInput {
  name: string;
  startDate?: Date | null;
  endDate?: Date | null;
  ongoing?: boolean;
}

export async function listSeasonsForBrand(
  db: Database,
  brandId: string,
): Promise<
  Array<{
    id: string;
    name: string;
    startDate: Date | null;
    endDate: Date | null;
    ongoing: boolean;
    createdAt: string;
    updatedAt: string;
  }>
> {
  const rows = await db
    .select()
    .from(brandSeasons)
    .where(eq(brandSeasons.brandId, brandId));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    startDate: row.startDate,
    endDate: row.endDate,
    ongoing: row.ongoing,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function createSeason(
  db: Database,
  brandId: string,
  input: SeasonInput,
): Promise<string> {
  const [row] = await db
    .insert(brandSeasons)
    .values({
      brandId,
      name: input.name,
      startDate: input.startDate,
      endDate: input.endDate,
      ongoing: input.ongoing ?? false,
    })
    .returning({ id: brandSeasons.id });

  if (!row) throw new Error("Failed to create season");
  return row.id;
}

export async function updateSeason(
  db: Database,
  brandId: string,
  seasonId: string,
  input: Partial<SeasonInput>,
): Promise<void> {
  await db
    .update(brandSeasons)
    .set({
      ...input,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)));
}

export async function deleteSeason(
  db: Database,
  brandId: string,
  seasonId: string,
): Promise<void> {
  await db
    .delete(brandSeasons)
    .where(and(eq(brandSeasons.id, seasonId), eq(brandSeasons.brandId, brandId)));
}
