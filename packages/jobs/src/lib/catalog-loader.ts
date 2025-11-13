import type { Database } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";

const {
  brandColors,
  brandSizes,
  brandMaterials,
  brandSeasons,
  categories,
  brandFacilities,
  valueMappings,
} = schema;

/**
 * Brand catalog data structure for in-memory lookups
 * All lookups are case-insensitive and trimmed
 */
export interface BrandCatalog {
  /** Map of normalized color name -> color ID */
  colors: Map<string, string>;
  /** Map of normalized size name -> size ID */
  sizes: Map<string, string>;
  /** Map of normalized material name -> material ID */
  materials: Map<string, string>;
  /** Map of normalized season name -> season ID */
  seasons: Map<string, string>;
  /** Map of normalized category name -> category ID (global, not brand-specific) */
  categories: Map<string, string>;
  /** Map of normalized operator/facility name -> facility ID */
  operators: Map<string, string>;
  /** Map of composite key (entityType:sourceColumn:rawValue) -> target ID */
  valueMappings: Map<string, string>;
}

/**
 * Normalize a value for consistent lookups
 * Converts to lowercase and trims whitespace
 *
 * @param value - Value to normalize
 * @returns Normalized value
 */
function normalizeValue(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * Create composite key for value mappings
 *
 * @param entityType - Entity type (COLOR, SIZE, MATERIAL, etc.)
 * @param sourceColumn - Source column name
 * @param rawValue - Raw value from CSV
 * @returns Composite key string
 */
function createMappingKey(
  entityType: string,
  sourceColumn: string,
  rawValue: string,
): string {
  return `${entityType}:${sourceColumn}:${normalizeValue(rawValue)}`;
}

/**
 * Load all brand catalog data into memory for fast lookups
 * This eliminates the N+1 query problem by loading all catalog data once
 *
 * @param db - Database instance
 * @param brandId - Brand ID to load catalog for
 * @returns Brand catalog with in-memory lookup maps
 */
export async function loadBrandCatalog(
  db: Database,
  brandId: string,
): Promise<BrandCatalog> {
  const loadStartTime = Date.now();

  // Load all catalog tables in parallel for maximum performance
  const [
    colors,
    sizes,
    materials,
    seasons,
    allCategories,
    facilities,
    mappings,
  ] = await Promise.all([
    db.query.brandColors.findMany({
      where: eq(brandColors.brandId, brandId),
      columns: { id: true, name: true },
    }),
    db.query.brandSizes.findMany({
      where: eq(brandSizes.brandId, brandId),
      columns: { id: true, name: true },
    }),
    db.query.brandMaterials.findMany({
      where: eq(brandMaterials.brandId, brandId),
      columns: { id: true, name: true },
    }),
    db.query.brandSeasons.findMany({
      where: eq(brandSeasons.brandId, brandId),
      columns: { id: true, name: true },
    }),
    db.query.categories.findMany({
      columns: { id: true, name: true },
    }),
    db.query.brandFacilities.findMany({
      where: eq(brandFacilities.brandId, brandId),
      columns: { id: true, displayName: true },
    }),
    db.query.valueMappings.findMany({
      where: eq(valueMappings.brandId, brandId),
      columns: {
        target: true,
        sourceColumn: true,
        rawValue: true,
        targetId: true,
      },
    }),
  ]);

  // Build case-insensitive lookup maps
  const catalog: BrandCatalog = {
    colors: new Map(colors.map((c) => [normalizeValue(c.name), c.id] as const)),
    sizes: new Map(sizes.map((s) => [normalizeValue(s.name), s.id] as const)),
    materials: new Map(
      materials.map((m) => [normalizeValue(m.name), m.id] as const),
    ),
    seasons: new Map(
      seasons.map((s) => [normalizeValue(s.name), s.id] as const),
    ),
    categories: new Map(
      allCategories.map((c) => [normalizeValue(c.name), c.id] as const),
    ),
    operators: new Map(
      facilities.map((f) => [normalizeValue(f.displayName), f.id] as const),
    ),
    valueMappings: new Map(),
  };

  // Add value mappings with composite keys
  for (const mapping of mappings) {
    const key = createMappingKey(
      mapping.target,
      mapping.sourceColumn,
      mapping.rawValue,
    );
    catalog.valueMappings.set(key, mapping.targetId);
  }

  const loadDuration = Date.now() - loadStartTime;

  console.log("[loadBrandCatalog] Catalog loaded successfully", {
    brandId,
    duration: `${loadDuration}ms`,
    stats: {
      colors: catalog.colors.size,
      sizes: catalog.sizes.size,
      materials: catalog.materials.size,
      seasons: catalog.seasons.size,
      categories: catalog.categories.size,
      operators: catalog.operators.size,
      valueMappings: catalog.valueMappings.size,
    },
  });

  return catalog;
}

/**
 * Lookup color ID from catalog
 *
 * @param catalog - Brand catalog
 * @param colorName - Color name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Color ID or null if not found
 */
export function lookupColorId(
  catalog: BrandCatalog,
  colorName: string,
  sourceColumn = "color_name",
): string | null {
  if (!colorName || colorName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(colorName);

  // Check value mappings first
  const mappingKey = createMappingKey("COLOR", sourceColumn, colorName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct color catalog
  return catalog.colors.get(normalized) || null;
}

/**
 * Lookup size ID from catalog
 *
 * @param catalog - Brand catalog
 * @param sizeName - Size name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Size ID or null if not found
 */
export function lookupSizeId(
  catalog: BrandCatalog,
  sizeName: string,
  sourceColumn = "size_name",
): string | null {
  if (!sizeName || sizeName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(sizeName);

  // Check value mappings first
  const mappingKey = createMappingKey("SIZE", sourceColumn, sizeName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct size catalog
  return catalog.sizes.get(normalized) || null;
}

/**
 * Lookup material ID from catalog
 *
 * @param catalog - Brand catalog
 * @param materialName - Material name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Material ID or null if not found
 */
export function lookupMaterialId(
  catalog: BrandCatalog,
  materialName: string,
  sourceColumn = "material_1_name",
): string | null {
  if (!materialName || materialName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(materialName);

  // Check value mappings first
  const mappingKey = createMappingKey("MATERIAL", sourceColumn, materialName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct material catalog
  return catalog.materials.get(normalized) || null;
}

/**
 * Lookup season ID from catalog
 *
 * @param catalog - Brand catalog
 * @param seasonName - Season name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Season ID or null if not found
 */
export function lookupSeasonId(
  catalog: BrandCatalog,
  seasonName: string,
  sourceColumn = "season",
): string | null {
  if (!seasonName || seasonName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(seasonName);

  // Check value mappings first
  const mappingKey = createMappingKey("SEASON", sourceColumn, seasonName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct season catalog
  return catalog.seasons.get(normalized) || null;
}

/**
 * Lookup category ID from catalog
 *
 * @param catalog - Brand catalog
 * @param categoryName - Category name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Category ID or null if not found
 */
export function lookupCategoryId(
  catalog: BrandCatalog,
  categoryName: string,
  sourceColumn = "category_name",
): string | null {
  if (!categoryName || categoryName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(categoryName);

  // Categories are global, check direct catalog only
  return catalog.categories.get(normalized) || null;
}

/**
 * Lookup operator/facility ID from catalog
 *
 * @param catalog - Brand catalog
 * @param operatorName - Operator/facility name to lookup
 * @param sourceColumn - Source column name for value mappings
 * @returns Operator ID or null if not found
 */
export function lookupOperatorId(
  catalog: BrandCatalog,
  operatorName: string,
  sourceColumn = "journey_steps",
): string | null {
  if (!operatorName || operatorName.trim() === "") {
    return null;
  }

  const normalized = normalizeValue(operatorName);

  // Check value mappings first
  const mappingKey = createMappingKey("OPERATOR", sourceColumn, operatorName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct operator catalog
  return catalog.operators.get(normalized) || null;
}

/**
 * Add color to in-memory catalog after auto-creation
 * This keeps the catalog synchronized without reloading
 *
 * @param catalog - Brand catalog to update
 * @param colorName - Color name that was created
 * @param colorId - Created color ID
 */
export function addColorToCatalog(
  catalog: BrandCatalog,
  colorName: string,
  colorId: string,
): void {
  const normalized = normalizeValue(colorName);
  catalog.colors.set(normalized, colorId);
}

/**
 * Get catalog statistics for logging/debugging
 *
 * @param catalog - Brand catalog
 * @returns Catalog statistics
 */
export function getCatalogStats(catalog: BrandCatalog): {
  colors: number;
  sizes: number;
  materials: number;
  categories: number;
  operators: number;
  valueMappings: number;
  total: number;
} {
  return {
    colors: catalog.colors.size,
    sizes: catalog.sizes.size,
    materials: catalog.materials.size,
    categories: catalog.categories.size,
    operators: catalog.operators.size,
    valueMappings: catalog.valueMappings.size,
    total:
      catalog.colors.size +
      catalog.sizes.size +
      catalog.materials.size +
      catalog.categories.size +
      catalog.operators.size +
      catalog.valueMappings.size,
  };
}
