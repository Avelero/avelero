import { db } from "@v1/db/client";
import type { Database } from "@v1/db/client";
import { and, eq, sql } from "@v1/db/queries";
import * as schema from "@v1/db/schema";

const {
  valueMappings,
  brandMaterials,
  taxonomyCategories,
  brandEcoClaims,
} = schema;

/**
 * Entity type enumeration for value mapping
 */
export enum EntityType {
  MATERIAL = "MATERIAL",
  CATEGORY = "CATEGORY",
  ECO_CLAIM = "ECO_CLAIM",
}

/**
 * Mapping result type
 */
export interface MappingResult {
  targetId: string | null;
  found: boolean;
  confidence: number; // 0-100, 100 for exact match
  matchType: "exact" | "fuzzy" | "none";
}

/**
 * Unmapped value information
 */
export interface UnmappedValue {
  entityType: EntityType;
  rawValue: string;
  sourceColumn: string;
  occurrences: number;
}

/**
 * Fuzzy match result with candidate information
 */
export interface FuzzyMatchResult {
  targetId: string;
  matchedValue: string;
  similarity: number; // 0-100
}

/**
 * Common synonym mappings for value variations
 */
const SYNONYM_MAP: Record<string, string[]> = {
  // Size synonyms
  "extra small": ["xs", "x-small"],
  small: ["s"],
  medium: ["m", "md"],
  large: ["l", "lg"],
  "extra large": ["xl", "x-large"],
  xxl: ["2xl", "xx-large", "extra extra large"],
  xxxl: ["3xl", "xxx-large"],

  // Color synonyms
  grey: ["gray"],
  blue: ["blu"],

  // Material synonyms
  polyester: ["poly"],
  cotton: ["cot"],
};

/**
 * Value mapping cache entry
 */
interface CacheEntry {
  targetId: string;
  timestamp: number;
}

/**
 * Value mapper class with caching and fuzzy matching
 */
export class ValueMapper {
  private cache: Map<string, CacheEntry>;
  private readonly CACHE_TTL = 3600000; // 1 hour in milliseconds
  private readonly FUZZY_THRESHOLD = 80; // Minimum similarity score (0-100) for fuzzy matches

  constructor(private readonly database: Database = db) {
    this.cache = new Map();
  }

  /**
   * Calculate Levenshtein distance between two strings
   * Used for fuzzy matching
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) {
      const row = matrix[i];
      if (row) {
        row[0] = i;
      }
    }

    for (let j = 0; j <= len2; j++) {
      const row = matrix[0];
      if (row) {
        row[j] = j;
      }
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        const currentRow = matrix[i];
        const prevRow = matrix[i - 1];
        const prevRowPrev = matrix[i - 1];

        if (currentRow && prevRow && prevRowPrev) {
          const deletion = (prevRow[j] ?? 0) + 1;
          const insertion = (currentRow[j - 1] ?? 0) + 1;
          const substitution = (prevRowPrev[j - 1] ?? 0) + cost;

          currentRow[j] = Math.min(deletion, insertion, substitution);
        }
      }
    }

    const lastRow = matrix[len1];
    return lastRow ? lastRow[len2] ?? 0 : 0;
  }

  /**
   * Calculate similarity percentage between two strings
   * Returns a value between 0 and 100
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const distance = this.levenshteinDistance(
      str1.toLowerCase(),
      str2.toLowerCase(),
    );
    const maxLength = Math.max(str1.length, str2.length);

    if (maxLength === 0) {
      return 100;
    }

    const similarity = ((maxLength - distance) / maxLength) * 100;
    return Math.round(similarity);
  }

  /**
   * Normalize string for comparison
   * Removes extra whitespace, converts to lowercase, removes special characters
   */
  private normalizeString(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ") // Replace multiple spaces with single space
      .replace(/[^\w\s-]/g, ""); // Remove special characters except spaces and hyphens
  }

  /**
   * Check if value matches any synonym in the synonym map
   */
  private findSynonymMatch(value: string): string | null {
    const normalized = this.normalizeString(value);

    // Check if value is a key in synonym map
    if (SYNONYM_MAP[normalized]) {
      return normalized;
    }

    // Check if value is a synonym for any key
    for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
      if (synonyms.some((syn) => syn === normalized)) {
        return key;
      }
    }

    return null;
  }

  /**
   * Perform fuzzy matching on a list of candidates
   * Returns matches above the similarity threshold, sorted by similarity
   */
  private fuzzyMatch(
    value: string,
    candidates: Array<{ id: string; name: string }>,
  ): FuzzyMatchResult[] {
    const normalizedValue = this.normalizeString(value);
    const results: FuzzyMatchResult[] = [];

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeString(candidate.name);
      const similarity = this.calculateSimilarity(
        normalizedValue,
        normalizedCandidate,
      );

      if (similarity >= this.FUZZY_THRESHOLD) {
        results.push({
          targetId: candidate.id,
          matchedValue: candidate.name,
          similarity,
        });
      }
    }

    // Sort by similarity (highest first)
    return results.sort((a, b) => b.similarity - a.similarity);
  }

  /**
   * Get cache key for value mapping
   */
  private getCacheKey(
    brandId: string,
    sourceColumn: string,
    rawValue: string,
  ): string {
    return `${brandId}:${sourceColumn}:${rawValue.toLowerCase().trim()}`;
  }

  /**
   * Check if cache entry is valid
   */
  private isCacheValid(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL;
  }

  /**
   * Add entry to cache
   */
  private addToCache(
    brandId: string,
    sourceColumn: string,
    rawValue: string,
    targetId: string,
  ): void {
    const key = this.getCacheKey(brandId, sourceColumn, rawValue);
    this.cache.set(key, {
      targetId,
      timestamp: Date.now(),
    });
  }

  /**
   * Get entry from cache
   */
  private getFromCache(
    brandId: string,
    sourceColumn: string,
    rawValue: string,
  ): string | null {
    const key = this.getCacheKey(brandId, sourceColumn, rawValue);
    const entry = this.cache.get(key);

    if (entry && this.isCacheValid(entry)) {
      return entry.targetId;
    }

    if (entry) {
      this.cache.delete(key);
    }

    return null;
  }

  /**
   * Clear expired cache entries
   */
  public clearExpiredCache(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.CACHE_TTL) {
        this.cache.delete(key);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Clear entire cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0, // TODO: Implement hit rate tracking
    };
  }

  /**
   * Map material name to material ID
   *
   * @param brandId - Brand ID to scope the lookup
   * @param materialName - Material name from CSV
   * @param sourceColumn - Source column name (e.g., "material_1_name")
   * @returns Mapping result with target ID if found
   */
  public async mapMaterialName(
    brandId: string,
    materialName: string,
    sourceColumn = "material_1_name",
  ): Promise<MappingResult> {
    if (!materialName || materialName.trim() === "") {
      return { targetId: null, found: false, confidence: 0, matchType: "none" };
    }

    const normalizedName = materialName.trim();

    // Check cache first
    const cached = this.getFromCache(brandId, sourceColumn, normalizedName);
    if (cached) {
      return {
        targetId: cached,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    // Check value_mappings table
    const existingMapping = await this.database.query.valueMappings.findFirst({
      where: and(
        eq(valueMappings.brandId, brandId),
        eq(valueMappings.sourceColumn, sourceColumn),
        sql`LOWER(TRIM(${valueMappings.rawValue})) = LOWER(TRIM(${normalizedName}))`,
      ),
    });

    if (existingMapping) {
      this.addToCache(
        brandId,
        sourceColumn,
        normalizedName,
        existingMapping.targetId,
      );
      return {
        targetId: existingMapping.targetId,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    // Query brand_materials directly
    const material = await this.database.query.brandMaterials.findFirst({
      where: and(
        eq(brandMaterials.brandId, brandId),
        sql`LOWER(TRIM(${brandMaterials.name})) = LOWER(TRIM(${normalizedName}))`,
      ),
    });

    if (material) {
      await this.createValueMapping(
        brandId,
        sourceColumn,
        normalizedName,
        EntityType.MATERIAL,
        material.id,
      );
      this.addToCache(brandId, sourceColumn, normalizedName, material.id);
      return {
        targetId: material.id,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    return { targetId: null, found: false, confidence: 0, matchType: "none" };
  }

  /**
   * Map category name to category ID
   * Note: Categories are global, not brand-specific
   *
   * @param categoryName - Category name from CSV
   * @param sourceColumn - Source column name (e.g., "category_name")
   * @returns Mapping result with target ID if found
   */
  public async mapCategoryName(
    categoryName: string,
    sourceColumn = "category_name",
  ): Promise<MappingResult> {
    if (!categoryName || categoryName.trim() === "") {
      return { targetId: null, found: false, confidence: 0, matchType: "none" };
    }

    const normalizedName = categoryName.trim();

    // Query categories directly (categories are global, no brand scoping)
    const category = await this.database.query.taxonomyCategories.findFirst({
      where: sql`LOWER(TRIM(${taxonomyCategories.name})) = LOWER(TRIM(${normalizedName}))`,
    });

    if (category) {
      return {
        targetId: category.id,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    return { targetId: null, found: false, confidence: 0, matchType: "none" };
  }

  /**
   * Map eco claim to eco claim ID
   *
   * @param brandId - Brand ID to scope the lookup
   * @param ecoClaimText - Eco claim text from CSV
   * @param sourceColumn - Source column name (e.g., "eco_claim")
   * @returns Mapping result with target ID if found
   */
  public async mapEcoClaimName(
    brandId: string,
    ecoClaimText: string,
    sourceColumn = "eco_claim",
  ): Promise<MappingResult> {
    if (!ecoClaimText || ecoClaimText.trim() === "") {
      return { targetId: null, found: false, confidence: 0, matchType: "none" };
    }

    const normalizedClaim = ecoClaimText.trim();

    // Check cache first
    const cached = this.getFromCache(brandId, sourceColumn, normalizedClaim);
    if (cached) {
      return {
        targetId: cached,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    // Check value_mappings table
    const existingMapping = await this.database.query.valueMappings.findFirst({
      where: and(
        eq(valueMappings.brandId, brandId),
        eq(valueMappings.sourceColumn, sourceColumn),
        sql`LOWER(TRIM(${valueMappings.rawValue})) = LOWER(TRIM(${normalizedClaim}))`,
      ),
    });

    if (existingMapping) {
      this.addToCache(
        brandId,
        sourceColumn,
        normalizedClaim,
        existingMapping.targetId,
      );
      return {
        targetId: existingMapping.targetId,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    // Query brand_eco_claims directly
    const ecoClaim = await this.database.query.brandEcoClaims.findFirst({
      where: and(
        eq(brandEcoClaims.brandId, brandId),
        sql`LOWER(TRIM(${brandEcoClaims.claim})) = LOWER(TRIM(${normalizedClaim}))`,
      ),
    });

    if (ecoClaim) {
      await this.createValueMapping(
        brandId,
        sourceColumn,
        normalizedClaim,
        EntityType.ECO_CLAIM,
        ecoClaim.id,
      );
      this.addToCache(brandId, sourceColumn, normalizedClaim, ecoClaim.id);
      return {
        targetId: ecoClaim.id,
        found: true,
        confidence: 100,
        matchType: "exact",
      };
    }

    return { targetId: null, found: false, confidence: 0, matchType: "none" };
  }

  /**
   * Create a value mapping entry
   *
   * @param brandId - Brand ID
   * @param sourceColumn - Source column name
   * @param rawValue - Raw value from CSV
   * @param target - Entity type
   * @param targetId - Target entity ID
   */
  private async createValueMapping(
    brandId: string,
    sourceColumn: string,
    rawValue: string,
    target: EntityType,
    targetId: string,
  ): Promise<void> {
    try {
      await this.database
        .insert(valueMappings)
        .values({
          brandId,
          sourceColumn,
          rawValue,
          target,
          targetId,
        })
        .onConflictDoNothing();
    } catch (error) {
      // Log error but don't throw - mapping will work without this entry
      console.error("Failed to create value mapping:", error);
    }
  }

  /**
   * Auto-create an eco-claim entity if it doesn't exist
   * Eco-claims are simple entities requiring only claim text
   *
   * @param brandId - Brand ID
   * @param claimText - Eco-claim text to create
   * @returns Created eco-claim ID or null if creation failed
   */
  public async autoCreateEcoClaim(
    brandId: string,
    claimText: string,
  ): Promise<string | null> {
    if (!claimText || claimText.trim() === "") {
      return null;
    }

    const normalizedClaim = claimText.trim();

    try {
      // Check if eco-claim already exists (case-insensitive)
      const existing = await this.database.query.brandEcoClaims.findFirst({
        where: and(
          eq(brandEcoClaims.brandId, brandId),
          sql`LOWER(TRIM(${brandEcoClaims.claim})) = LOWER(TRIM(${normalizedClaim}))`,
        ),
      });

      if (existing) {
        return existing.id;
      }

      // Create new eco-claim
      const [newEcoClaim] = await this.database
        .insert(brandEcoClaims)
        .values({
          brandId,
          claim: normalizedClaim,
        })
        .returning();

      if (!newEcoClaim) {
        throw new Error("Failed to create eco-claim - no rows returned");
      }

      console.log(
        `Auto-created eco-claim: ${normalizedClaim} for brand ${brandId}`,
      );
      return newEcoClaim.id;
    } catch (error) {
      console.error(`Failed to auto-create eco-claim "${claimText}":`, error);
      return null;
    }
  }

  /**
   * Auto-create simple entity (color or eco-claim) based on entity type
   *
   * @param brandId - Brand ID
   * @param entityType - Type of entity to create
   * @param value - Value to create
   * @returns Created entity ID or null if creation failed or entity type not supported
   */
  public async autoCreateSimpleEntity(
    brandId: string,
    entityType: EntityType,
    value: string,
  ): Promise<string | null> {
    switch (entityType) {
      case EntityType.ECO_CLAIM:
        return this.autoCreateEcoClaim(brandId, value);
      default:
        // Complex entities (materials, categories, facilities, etc.) require additional fields
        // and should be created through the user approval workflow
        console.warn(
          `Entity type ${entityType} cannot be auto-created - requires user input`,
        );
        return null;
    }
  }

  /**
   * Validate if value is suitable for auto-creation
   * Checks for suspicious patterns, SQL injection attempts, etc.
   *
   * @param value - Value to validate
   * @returns True if value is safe to auto-create
   */
  private isValidForAutoCreation(value: string): boolean {
    if (!value || value.trim() === "") {
      return false;
    }

    // Reject values that are too long
    if (value.length > 100) {
      return false;
    }

    // Reject values with SQL injection patterns
    const suspiciousPatterns = [
      /(\bOR\b|\bAND\b)\s*\d+\s*=\s*\d+/i, // OR 1=1, AND 1=1
      /;\s*(DROP|DELETE|INSERT|UPDATE|ALTER|CREATE)/i, // SQL keywords after semicolon
      /UNION\s+SELECT/i, // UNION SELECT
      /<script/i, // XSS attempts
    ];

    return !suspiciousPatterns.some((pattern) => pattern.test(value));
  }

  /**
   * Detect unmapped values in CSV data
   * Analyzes CSV rows to find values that don't have corresponding entities in brand catalog
   *
   * @param brandId - Brand ID to scope the lookup
   * @param rows - Array of CSV row data
   * @param columnMappings - Map of CSV columns to entity types (e.g., {"color_name": "COLOR"})
   * @returns Array of unmapped values with occurrence counts
   */
  public async detectUnmappedValues(
    brandId: string,
    rows: Array<Record<string, unknown>>,
    columnMappings: Record<string, EntityType>,
  ): Promise<UnmappedValue[]> {
    const unmappedMap = new Map<string, UnmappedValue>();

    // Process each row
    for (const row of rows) {
      for (const [column, entityType] of Object.entries(columnMappings)) {
        const value = row[column];

        if (!value || typeof value !== "string" || value.trim() === "") {
          continue;
        }

        const normalizedValue = value.trim();
        const mapKey = `${entityType}:${column}:${normalizedValue.toLowerCase()}`;

        // Skip if already processed
        if (unmappedMap.has(mapKey)) {
          const existing = unmappedMap.get(mapKey)!;
          existing.occurrences++;
          continue;
        }

        // Try to map the value
        let mappingResult: MappingResult;

        switch (entityType) {
          case EntityType.MATERIAL:
            mappingResult = await this.mapMaterialName(
              brandId,
              normalizedValue,
              column,
            );
            break;
          case EntityType.CATEGORY:
            mappingResult = await this.mapCategoryName(normalizedValue, column);
            break;
          case EntityType.ECO_CLAIM:
            mappingResult = await this.mapEcoClaimName(
              brandId,
              normalizedValue,
              column,
            );
            break;
          default:
            continue;
        }

        // If not found, add to unmapped list
        if (!mappingResult.found) {
          unmappedMap.set(mapKey, {
            entityType,
            rawValue: normalizedValue,
            sourceColumn: column,
            occurrences: 1,
          });
        }
      }
    }

    // Convert map to array and sort by occurrences (descending)
    return Array.from(unmappedMap.values()).sort(
      (a, b) => b.occurrences - a.occurrences,
    );
  }

  /**
   * Detect unmapped values for a specific entity type
   * More efficient when checking only one type of entity
   *
   * @param brandId - Brand ID to scope the lookup
   * @param values - Array of values to check
   * @param entityType - Entity type to check
   * @param sourceColumn - Source column name
   * @returns Array of unmapped values
   */
  public async detectUnmappedValuesForType(
    brandId: string,
    values: string[],
    entityType: EntityType,
    sourceColumn: string,
  ): Promise<UnmappedValue[]> {
    const unmappedMap = new Map<string, UnmappedValue>();

    for (const value of values) {
      if (!value || value.trim() === "") {
        continue;
      }

      const normalizedValue = value.trim();
      const mapKey = normalizedValue.toLowerCase();

      // Skip if already processed
      if (unmappedMap.has(mapKey)) {
        const existing = unmappedMap.get(mapKey)!;
        existing.occurrences++;
        continue;
      }

      // Try to map the value
      let mappingResult: MappingResult;

      switch (entityType) {
        case EntityType.MATERIAL:
          mappingResult = await this.mapMaterialName(
            brandId,
            normalizedValue,
            sourceColumn,
          );
          break;
        case EntityType.CATEGORY:
          mappingResult = await this.mapCategoryName(
            normalizedValue,
            sourceColumn,
          );
          break;
        case EntityType.ECO_CLAIM:
          mappingResult = await this.mapEcoClaimName(
            brandId,
            normalizedValue,
            sourceColumn,
          );
          break;
        default:
          continue;
      }

      // If not found, add to unmapped list
      if (!mappingResult.found) {
        unmappedMap.set(mapKey, {
          entityType,
          rawValue: normalizedValue,
          sourceColumn,
          occurrences: 1,
        });
      }
    }

    return Array.from(unmappedMap.values()).sort(
      (a, b) => b.occurrences - a.occurrences,
    );
  }

  /**
   * Get suggestions for unmapped values using fuzzy matching
   * Helps users understand potential matches before creating new entities
   *
   * @param brandId - Brand ID
   * @param unmappedValue - Unmapped value to find suggestions for
   * @returns Array of fuzzy match suggestions
   */
  public async getSuggestionsForUnmappedValue(
    brandId: string,
    unmappedValue: UnmappedValue,
  ): Promise<FuzzyMatchResult[]> {
    const { entityType, rawValue } = unmappedValue;

    let candidates: Array<{ id: string; name: string }> = [];

    // Fetch all entities of the specified type
    switch (entityType) {
      case EntityType.MATERIAL: {
        const materials = await this.database.query.brandMaterials.findMany({
          where: eq(brandMaterials.brandId, brandId),
        });
        candidates = materials.map((m): { id: string; name: string } => ({
          id: m.id,
          name: m.name,
        }));
        break;
      }
      case EntityType.CATEGORY: {
        const cats = await this.database.query.taxonomyCategories.findMany({});
        candidates = cats.map((c): { id: string; name: string } => ({
          id: c.id,
          name: c.name,
        }));
        break;
      }
      case EntityType.ECO_CLAIM: {
        const claims = await this.database.query.brandEcoClaims.findMany({
          where: eq(brandEcoClaims.brandId, brandId),
        });
        candidates = claims.map((c): { id: string; name: string } => ({
          id: c.id,
          name: c.claim,
        }));
        break;
      }
    }

    // Perform fuzzy matching with lower threshold for suggestions
    const normalizedValue = this.normalizeString(rawValue);
    const results: FuzzyMatchResult[] = [];

    for (const candidate of candidates) {
      const normalizedCandidate = this.normalizeString(candidate.name);
      const similarity = this.calculateSimilarity(
        normalizedValue,
        normalizedCandidate,
      );

      // Use lower threshold (60) for suggestions
      if (similarity >= 60) {
        results.push({
          targetId: candidate.id,
          matchedValue: candidate.name,
          similarity,
        });
      }
    }

    // Sort by similarity (highest first) and limit to top 5
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }
}

/**
 * Global value mapper instance
 */
export const valueMapper = new ValueMapper();
