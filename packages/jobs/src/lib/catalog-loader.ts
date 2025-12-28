import type { Database } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";

const {
  brandMaterials,
  brandSeasons,
  taxonomyCategories,
  brandFacilities,
  valueMappings,
} = schema;

/**
 * Brand catalog data structure for in-memory lookups
 * All lookups are case-insensitive and trimmed
 *
 * Note: colors and sizes maps removed in Phase 5 of variant attribute migration.
 * Colors and sizes are now managed via generic brand attributes.
 */
export interface BrandCatalog {
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
 * Note: colors and sizes no longer loaded - managed via generic brand attributes.
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
  const [materials, seasons, allCategories, facilities, mappings] =
    await Promise.all([
      db.query.brandMaterials.findMany({
        where: eq(brandMaterials.brandId, brandId),
        columns: { id: true, name: true },
      }),
      db.query.brandSeasons.findMany({
        where: eq(brandSeasons.brandId, brandId),
        columns: { id: true, name: true },
      }),
      db.query.taxonomyCategories.findMany({
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
    materials: new Map(
      materials.map(
        (m: { id: string; name: string }) =>
          [normalizeValue(m.name), m.id] as const,
      ),
    ),
    seasons: new Map(
      seasons.map(
        (s: { id: string; name: string }) =>
          [normalizeValue(s.name), s.id] as const,
      ),
    ),
    categories: new Map(
      allCategories.map(
        (c: { id: string; name: string }) =>
          [normalizeValue(c.name), c.id] as const,
      ),
    ),
    operators: new Map(
      facilities.map(
        (f: { id: string; displayName: string | null }) =>
          [normalizeValue(f.displayName ?? ""), f.id] as const,
      ),
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

  // Check value mappings first (use "FACILITY" not "OPERATOR" for value_mappings target)
  const mappingKey = createMappingKey("FACILITY", sourceColumn, operatorName);
  const mappedId = catalog.valueMappings.get(mappingKey);
  if (mappedId) {
    return mappedId;
  }

  // Check direct operator catalog
  return catalog.operators.get(normalized) || null;
}

/**
 * Get catalog statistics for logging/debugging
 *
 * @param catalog - Brand catalog
 * @returns Catalog statistics
 */
export function getCatalogStats(catalog: BrandCatalog): {
  materials: number;
  seasons: number;
  categories: number;
  operators: number;
  valueMappings: number;
  total: number;
} {
  return {
    materials: catalog.materials.size,
    seasons: catalog.seasons.size,
    categories: catalog.categories.size,
    operators: catalog.operators.size,
    valueMappings: catalog.valueMappings.size,
    total:
      catalog.materials.size +
      catalog.seasons.size +
      catalog.categories.size +
      catalog.operators.size +
      catalog.valueMappings.size,
  };
}
