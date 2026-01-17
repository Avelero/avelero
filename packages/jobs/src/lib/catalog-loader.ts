import type { Database } from "@v1/db/client";
import { eq } from "@v1/db/queries";
import * as schema from "@v1/db/schema";

const {
  brandMaterials,
  brandSeasons,
  taxonomyCategories,
  taxonomyAttributes,
  taxonomyValues,
  brandOperators,
  valueMappings,
  brandAttributes,
  brandAttributeValues,
  brandTags,
  brandManufacturers,
} = schema;

/**
 * Attribute value with parent attribute reference
 */
export interface AttributeValueInfo {
  id: string;
  name: string;
  attributeId: string;
  attributeName: string;
}

/**
 * Taxonomy attribute info for matching
 */
export interface TaxonomyAttributeInfo {
  id: string;
  name: string;
  friendlyId: string;
}

/**
 * Taxonomy value info for matching
 */
export interface TaxonomyValueInfo {
  id: string;
  name: string;
  attributeId: string;
  friendlyId: string;
}

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
  /** Map of normalized attribute name -> attribute ID */
  attributes: Map<string, string>;
  /** Map of normalized attribute name -> taxonomyAttributeId (for brand attributes linked to taxonomy) */
  attributeTaxonomyLinks: Map<string, string>;
  /** Map of composite key (attributeId:normalizedValueName) -> attribute value info */
  attributeValues: Map<string, AttributeValueInfo>;
  /** Map of normalized tag name -> tag ID */
  tags: Map<string, string>;
  /** Map of normalized manufacturer name -> manufacturer ID */
  manufacturers: Map<string, string>;

  // Taxonomy data for matching imported attributes/values to global taxonomy
  /** Map of normalized taxonomy attribute name -> taxonomy attribute info */
  taxonomyAttributes: Map<string, TaxonomyAttributeInfo>;
  /** Map of composite key (taxonomyAttributeId:normalizedValueName) -> taxonomy value info */
  taxonomyValues: Map<string, TaxonomyValueInfo>;
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
  const [
    materials,
    seasons,
    allCategories,
    facilities,
    mappings,
    attributes,
    attributeValuesData,
    tags,
    manufacturers,
    // Taxonomy data for matching
    allTaxonomyAttributes,
    allTaxonomyValues,
  ] = await Promise.all([
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
    db.query.brandOperators.findMany({
      where: eq(brandOperators.brandId, brandId),
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
    db.query.brandAttributes.findMany({
      where: eq(brandAttributes.brandId, brandId),
      columns: { id: true, name: true, taxonomyAttributeId: true },
    }),
    db.query.brandAttributeValues.findMany({
      where: eq(brandAttributeValues.brandId, brandId),
      columns: {
        id: true,
        name: true,
        attributeId: true,
        taxonomyValueId: true,
      },
    }),
    db.query.brandTags.findMany({
      where: eq(brandTags.brandId, brandId),
      columns: { id: true, name: true },
    }),
    db.query.brandManufacturers.findMany({
      where: eq(brandManufacturers.brandId, brandId),
      columns: { id: true, name: true },
    }),
    // Load taxonomy attributes for matching
    db.query.taxonomyAttributes.findMany({
      columns: { id: true, name: true, friendlyId: true },
    }),
    // Load taxonomy values for matching
    db.query.taxonomyValues.findMany({
      columns: { id: true, name: true, attributeId: true, friendlyId: true },
    }),
  ]);

  // Build attribute ID -> name map for attribute value lookups
  const attributeIdToName = new Map<string, string>(
    attributes.map((a: { id: string; name: string }) => [a.id, a.name]),
  );

  // Build attribute ID -> taxonomyAttributeId map (for brand attributes linked to taxonomy)
  const attributeIdToTaxonomyId = new Map<string, string>();
  for (const attr of attributes) {
    if ((attr as { taxonomyAttributeId?: string | null }).taxonomyAttributeId) {
      attributeIdToTaxonomyId.set(
        attr.id,
        (attr as { taxonomyAttributeId: string }).taxonomyAttributeId,
      );
    }
  }

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
    attributes: new Map(
      attributes.map(
        (a: { id: string; name: string }) =>
          [normalizeValue(a.name), a.id] as const,
      ),
    ),
    attributeTaxonomyLinks: new Map(),
    attributeValues: new Map(),
    tags: new Map(
      tags.map(
        (t: { id: string; name: string }) =>
          [normalizeValue(t.name), t.id] as const,
      ),
    ),
    manufacturers: new Map(
      manufacturers.map(
        (m: { id: string; name: string }) =>
          [normalizeValue(m.name), m.id] as const,
      ),
    ),
    // Taxonomy data for matching
    taxonomyAttributes: new Map(
      allTaxonomyAttributes.map(
        (ta: { id: string; name: string; friendlyId: string }) =>
          [
            normalizeValue(ta.name),
            { id: ta.id, name: ta.name, friendlyId: ta.friendlyId },
          ] as const,
      ),
    ),
    taxonomyValues: new Map(),
  };

  // Build taxonomy values map with composite key (taxonomyAttributeId:normalizedValueName)
  for (const tv of allTaxonomyValues) {
    const key = `${tv.attributeId}:${normalizeValue(tv.name)}`;
    catalog.taxonomyValues.set(key, {
      id: tv.id,
      name: tv.name,
      attributeId: tv.attributeId,
      friendlyId: tv.friendlyId,
    });
  }

  // Build attributeTaxonomyLinks map (normalized attr name -> taxonomyAttributeId)
  for (const attr of attributes) {
    const typedAttr = attr as {
      id: string;
      name: string;
      taxonomyAttributeId?: string | null;
    };
    if (typedAttr.taxonomyAttributeId) {
      catalog.attributeTaxonomyLinks.set(
        normalizeValue(typedAttr.name),
        typedAttr.taxonomyAttributeId,
      );
    }
  }

  // Build attribute values map with composite key (attributeId:valueName)
  for (const av of attributeValuesData) {
    const attributeName = attributeIdToName.get(av.attributeId) || "";
    const key = `${av.attributeId}:${normalizeValue(av.name)}`;
    catalog.attributeValues.set(key, {
      id: av.id,
      name: av.name,
      attributeId: av.attributeId,
      attributeName: attributeName,
    });
  }

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
