import { z } from "zod";
import type { AnyPgTable } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { eq, and } from "drizzle-orm";

// ================================
// Cross-Module Include System
// ================================

/**
 * Defines the relationship types between modules
 */
export const relationshipTypeEnum = z.enum([
  "one-to-one", // 1:1 relationship (e.g., passport -> template)
  "one-to-many", // 1:N relationship (e.g., product -> variants)
  "many-to-one", // N:1 relationship (e.g., variants -> product)
  "many-to-many", // N:N relationship (e.g., products -> categories via junction)
]);

export type RelationshipType = z.infer<typeof relationshipTypeEnum>;

/**
 * Configuration for a cross-module relationship
 */
export interface CrossModuleRelationship {
  /** The target module this relationship points to */
  targetModule: string;

  /** Type of relationship */
  relationshipType: RelationshipType;

  /** Source table for the relationship */
  sourceTable: AnyPgTable;

  /** Target table for the relationship */
  targetTable: AnyPgTable;

  /** Join condition(s) for the relationship */
  joinCondition: (source: AnyPgTable, target: AnyPgTable) => SQL;

  /** Optional filter conditions for the target */
  targetFilter?: (target: AnyPgTable) => SQL;

  /** Whether this relationship should be available in includes */
  includeSupported: boolean;

  /** Performance hints for query optimization */
  performance?: {
    /** Expected cardinality (low, medium, high) */
    expectedCardinality?: "low" | "medium" | "high";

    /** Whether to use subquery instead of join for better performance */
    preferSubquery?: boolean;

    /** Whether this relationship is expensive to compute */
    expensive?: boolean;
  };
}

/**
 * Registry of all cross-module relationships
 */
export class CrossModuleRelationshipRegistry {
  private relationships = new Map<
    string,
    Map<string, CrossModuleRelationship>
  >();

  /**
   * Register a relationship between two modules
   */
  register(
    sourceModule: string,
    targetKey: string,
    relationship: CrossModuleRelationship,
  ): void {
    if (!this.relationships.has(sourceModule)) {
      this.relationships.set(sourceModule, new Map());
    }

    this.relationships.get(sourceModule)!.set(targetKey, relationship);
  }

  /**
   * Get all relationships for a source module
   */
  getRelationships(sourceModule: string): Map<string, CrossModuleRelationship> {
    return this.relationships.get(sourceModule) || new Map();
  }

  /**
   * Get a specific relationship
   */
  getRelationship(
    sourceModule: string,
    targetKey: string,
  ): CrossModuleRelationship | undefined {
    return this.relationships.get(sourceModule)?.get(targetKey);
  }

  /**
   * Check if a relationship exists
   */
  hasRelationship(sourceModule: string, targetKey: string): boolean {
    return this.relationships.get(sourceModule)?.has(targetKey) || false;
  }

  /**
   * Get all available include keys for a module
   */
  getAvailableIncludes(sourceModule: string): string[] {
    const moduleRelationships = this.relationships.get(sourceModule);
    if (!moduleRelationships) return [];

    return Array.from(moduleRelationships.entries())
      .filter(([_, relationship]) => relationship.includeSupported)
      .map(([key, _]) => key);
  }
}

/**
 * Global registry instance
 */
export const crossModuleRegistry = new CrossModuleRelationshipRegistry();

/**
 * Creates a cross-module include schema for a specific module
 */
export function createCrossModuleIncludeSchema(sourceModule: string) {
  const availableIncludes =
    crossModuleRegistry.getAvailableIncludes(sourceModule);

  // Create dynamic schema object with all available cross-module includes
  const schemaShape: Record<string, z.ZodDefault<z.ZodBoolean>> = {};

  for (const includeKey of availableIncludes) {
    schemaShape[includeKey] = z.boolean().default(false);
  }

  return z.object(schemaShape).strict();
}

/**
 * Query builder helper for cross-module includes
 */
export interface CrossModuleQueryBuilder {
  /** Build select fields for cross-module includes */
  buildSelectFields(includes: Record<string, boolean>): Record<string, any>;

  /** Build join operations for cross-module includes */
  buildJoins(query: any, includes: Record<string, boolean>): any;

  /** Transform query results to include cross-module data */
  transformResults(results: any[], includes: Record<string, boolean>): any[];
}

/**
 * Creates a query builder for cross-module operations
 */
export function createCrossModuleQueryBuilder(
  sourceModule: string,
  sourceTable: AnyPgTable,
): CrossModuleQueryBuilder {
  return {
    buildSelectFields(includes: Record<string, boolean>) {
      const selectFields: Record<string, any> = {
        [sourceModule]: sourceTable,
      };

      for (const [includeKey, isIncluded] of Object.entries(includes)) {
        if (!isIncluded) continue;

        const relationship = crossModuleRegistry.getRelationship(
          sourceModule,
          includeKey,
        );
        if (relationship?.includeSupported) {
          selectFields[includeKey] = relationship.targetTable;
        }
      }

      return selectFields;
    },

    buildJoins(query: any, includes: Record<string, boolean>) {
      let joinedQuery = query;

      for (const [includeKey, isIncluded] of Object.entries(includes)) {
        if (!isIncluded) continue;

        const relationship = crossModuleRegistry.getRelationship(
          sourceModule,
          includeKey,
        );
        if (!relationship?.includeSupported) continue;

        const joinCondition = relationship.joinCondition(
          sourceTable,
          relationship.targetTable,
        );
        const conditions = relationship.targetFilter
          ? and(
              joinCondition,
              relationship.targetFilter(relationship.targetTable),
            )
          : joinCondition;

        // Use leftJoin to preserve source records even if target doesn't exist
        joinedQuery = joinedQuery.leftJoin(
          relationship.targetTable,
          conditions,
        );
      }

      return joinedQuery;
    },

    transformResults(results: any[], includes: Record<string, boolean>) {
      return results.map((result) => {
        const transformed: any = { ...result[sourceModule] };

        for (const [includeKey, isIncluded] of Object.entries(includes)) {
          if (!isIncluded) continue;

          const relationship = crossModuleRegistry.getRelationship(
            sourceModule,
            includeKey,
          );
          if (relationship?.includeSupported && result[includeKey]) {
            transformed[includeKey] = result[includeKey];
          }
        }

        return transformed;
      });
    },
  };
}

/**
 * Performance analysis for cross-module queries
 */
export interface QueryPerformanceMetrics {
  /** Expected number of joins */
  joinCount: number;

  /** Whether query includes expensive relationships */
  hasExpensiveRelationships: boolean;

  /** Estimated cardinality */
  estimatedCardinality: "low" | "medium" | "high";

  /** Recommended query strategy */
  recommendedStrategy: "join" | "subquery" | "separate_queries";
}

/**
 * Analyzes performance implications of cross-module includes
 */
export function analyzeQueryPerformance(
  sourceModule: string,
  includes: Record<string, boolean>,
): QueryPerformanceMetrics {
  let joinCount = 0;
  let hasExpensiveRelationships = false;
  let maxCardinality: "low" | "medium" | "high" = "low";

  for (const [includeKey, isIncluded] of Object.entries(includes)) {
    if (!isIncluded) continue;

    const relationship = crossModuleRegistry.getRelationship(
      sourceModule,
      includeKey,
    );
    if (!relationship?.includeSupported) continue;

    joinCount++;

    if (relationship.performance?.expensive) {
      hasExpensiveRelationships = true;
    }

    const cardinality = relationship.performance?.expectedCardinality || "low";
    if (
      cardinality === "high" ||
      (cardinality === "medium" && maxCardinality === "low")
    ) {
      maxCardinality = cardinality;
    }
  }

  // Determine recommended strategy
  let recommendedStrategy: "join" | "subquery" | "separate_queries" = "join";

  if (joinCount > 3 || hasExpensiveRelationships) {
    recommendedStrategy = "separate_queries";
  } else if (maxCardinality === "high") {
    recommendedStrategy = "subquery";
  }

  return {
    joinCount,
    hasExpensiveRelationships,
    estimatedCardinality: maxCardinality,
    recommendedStrategy,
  };
}

/**
 * Decorator for registering cross-module relationships
 */
export function registerCrossModuleRelationship(
  sourceModule: string,
  targetKey: string,
  relationship: CrossModuleRelationship,
) {
  return function (target: any) {
    crossModuleRegistry.register(sourceModule, targetKey, relationship);
    return target;
  };
}

/**
 * Utility type for inferring cross-module include schema
 */
export type InferCrossModuleIncludes<T extends string> = z.infer<
  ReturnType<typeof createCrossModuleIncludeSchema>
>;
