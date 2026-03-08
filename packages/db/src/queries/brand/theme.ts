import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandTheme } from "../../schema";

export type BrandThemeRow = {
  brandId: string;
  passport: unknown;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fetches the theme (passport) for a brand.
 */
export async function getBrandTheme(
  db: Database,
  brandId: string,
): Promise<BrandThemeRow | null> {
  const [row] = await db
    .select({
      brandId: brandTheme.brandId,
      passport: brandTheme.passport,
      stylesheetPath: brandTheme.stylesheetPath,
      googleFontsUrl: brandTheme.googleFontsUrl,
      createdAt: brandTheme.createdAt,
      updatedAt: brandTheme.updatedAt,
    })
    .from(brandTheme)
    .where(eq(brandTheme.brandId, brandId))
    .limit(1);

  return row ?? null;
}

/**
 * Updates the passport for a brand.
 */
export async function updatePassport(
  db: Database,
  brandId: string,
  passport: unknown,
): Promise<{ success: true; updatedAt: string }> {
  const now = new Date().toISOString();

  await db
    .update(brandTheme)
    .set({
      passport,
      updatedAt: now,
    })
    .where(eq(brandTheme.brandId, brandId));

  return { success: true, updatedAt: now };
}
