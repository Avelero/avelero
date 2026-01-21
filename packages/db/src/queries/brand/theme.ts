import { eq } from "drizzle-orm";
import type { Database } from "../../client";
import { brandTheme } from "../../schema";

export type BrandThemeRow = {
  brandId: string;
  themeStyles: unknown;
  themeConfig: unknown;
  stylesheetPath: string | null;
  googleFontsUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * Fetches the theme configuration for a brand.
 * Returns the theme styles and config, or null if no theme exists.
 */
export async function getBrandTheme(
  db: Database,
  brandId: string,
): Promise<BrandThemeRow | null> {
  const [row] = await db
    .select({
      brandId: brandTheme.brandId,
      themeStyles: brandTheme.themeStyles,
      themeConfig: brandTheme.themeConfig,
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
 * Updates the theme config (content) for a brand.
 * Only updates the theme_config column, preserving theme_styles.
 */
export async function updateBrandThemeConfig(
  db: Database,
  brandId: string,
  themeConfig: unknown,
): Promise<{ success: true; updatedAt: string }> {
  const now = new Date().toISOString();

  await db
    .update(brandTheme)
    .set({
      themeConfig,
      updatedAt: now,
    })
    .where(eq(brandTheme.brandId, brandId));

  return { success: true, updatedAt: now };
}
