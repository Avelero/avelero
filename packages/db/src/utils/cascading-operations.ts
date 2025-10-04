import { TRPCError } from "@trpc/server";
import { and, eq, isNull, isNotNull, inArray, or, count } from "drizzle-orm";
import {
  passports,
  products,
  productVariants,
  templates,
  modules,
  brands,
  categories,
} from "../schema/index.js";
import type { Database } from "../client.js";
import {
  executeTransaction,
  createOperation,
  createValidationOperation,
  createDataOperation,
  type TransactionOperation,
  type TransactionConfig,
  type TransactionContext,
} from "./transactions.js";
import { validateBeforeDeletion } from "./foreign-key-validation.js";

/**
 * Cascading Operations Handler
 *
 * Manages operations that cascade across multiple modules to maintain
 * data consistency and handle complex relationships properly.
 */

// ================================
// TYPES AND INTERFACES
// ================================

export interface CascadeOperationResult {
  success: boolean;
  operations: string[];
  affectedRecords: {
    [table: string]: number;
  };
  error?: string;
  warnings?: string[];
}

export interface CascadeStrategy {
  /** Action to take on dependent records */
  action: 'cascade_delete' | 'set_null' | 'set_default' | 'prevent' | 'soft_delete';
  /** Priority of the cascade operation (higher numbers execute first) */
  priority: number;
  /** Whether to validate before cascading */
  validate: boolean;
  /** Custom validation function */
  customValidation?: (db: TransactionContext, entityIds: string[]) => Promise<boolean>;
}

export interface CascadeDefinition {
  sourceTable: string;
  targetTable: string;
  sourceField: string;
  targetField: string;
  strategy: CascadeStrategy;
  brandScoped: boolean;
}

// ================================
// CASCADE DEFINITIONS
// ================================

/**
 * Define all cascading relationships and their strategies
 */
export const CASCADE_DEFINITIONS: CascadeDefinition[] = [
  // Brand deletions
  {
    sourceTable: 'brands',
    targetTable: 'products',
    sourceField: 'id',
    targetField: 'brandId',
    strategy: {
      action: 'cascade_delete',
      priority: 100,
      validate: true,
    },
    brandScoped: false,
  },
  {
    sourceTable: 'brands',
    targetTable: 'passports',
    sourceField: 'id',
    targetField: 'brandId',
    strategy: {
      action: 'cascade_delete',
      priority: 90,
      validate: true,
    },
    brandScoped: false,
  },
  {
    sourceTable: 'brands',
    targetTable: 'templates',
    sourceField: 'id',
    targetField: 'brandId',
    strategy: {
      action: 'cascade_delete',
      priority: 95,
      validate: true,
    },
    brandScoped: false,
  },
  {
    sourceTable: 'brands',
    targetTable: 'categories',
    sourceField: 'id',
    targetField: 'brandId',
    strategy: {
      action: 'cascade_delete',
      priority: 85,
      validate: true,
    },
    brandScoped: false,
  },

  // Product deletions
  {
    sourceTable: 'products',
    targetTable: 'product_variants',
    sourceField: 'id',
    targetField: 'productId',
    strategy: {
      action: 'cascade_delete',
      priority: 100,
      validate: true,
    },
    brandScoped: true,
  },
  {
    sourceTable: 'products',
    targetTable: 'passports',
    sourceField: 'id',
    targetField: 'productId',
    strategy: {
      action: 'cascade_delete',
      priority: 90,
      validate: true,
    },
    brandScoped: true,
  },

  // Template deletions
  {
    sourceTable: 'templates',
    targetTable: 'modules',
    sourceField: 'id',
    targetField: 'templateId',
    strategy: {
      action: 'cascade_delete',
      priority: 100,
      validate: true,
    },
    brandScoped: true,
  },
  {
    sourceTable: 'templates',
    targetTable: 'passports',
    sourceField: 'id',
    targetField: 'templateId',
    strategy: {
      action: 'set_null',
      priority: 90,
      validate: true,
    },
    brandScoped: true,
  },

  // Category deletions
  {
    sourceTable: 'categories',
    targetTable: 'products',
    sourceField: 'id',
    targetField: 'categoryId',
    strategy: {
      action: 'set_null',
      priority: 90,
      validate: true,
    },
    brandScoped: true,
  },
  {
    sourceTable: 'categories',
    targetTable: 'categories',
    sourceField: 'id',
    targetField: 'parentId',
    strategy: {
      action: 'set_null',
      priority: 95,
      validate: true,
    },
    brandScoped: true,
  },

  // Variant deletions (passports may reference variants directly)
  {
    sourceTable: 'product_variants',
    targetTable: 'passports',
    sourceField: 'id',
    targetField: 'variantId',
    strategy: {
      action: 'set_null',
      priority: 90,
      validate: true,
    },
    brandScoped: true,
  },
];

// ================================
// CORE CASCADING FUNCTIONS
// ================================

/**
 * Execute cascading operations for entity deletion
 */
export async function executeCascadingDeletion(
  db: Database,
  sourceTable: string,
  entityIds: string[],
  brandId?: string,
  config?: TransactionConfig
): Promise<CascadeOperationResult> {
  const operations: TransactionOperation[] = [];
  const warnings: string[] = [];
  let affectedRecords: { [table: string]: number } = {};

  // Get all cascade definitions for this source table
  const cascades = CASCADE_DEFINITIONS
    .filter(def => def.sourceTable === sourceTable)
    .sort((a, b) => b.strategy.priority - a.strategy.priority); // Higher priority first

  // Add validation operation
  operations.push(
    createValidationOperation('validate-deletion-constraints', async (tx) => {
      const validation = await validateBeforeDeletion(tx, sourceTable, entityIds, brandId);

      if (!validation.canDelete) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Cannot delete ${sourceTable}: blocking references exist`,
          cause: validation.blockingReferences,
        });
      }

      // Add warnings for cascade effects
      validation.blockingReferences.forEach(ref => {
        warnings.push(`${ref.constraint}: ${ref.count} records in ${ref.table}.${ref.field}`);
      });

      return validation;
    })
  );

  // Create cascade operations
  for (const cascade of cascades) {
    operations.push(
      createDataOperation(`cascade-${cascade.action}-${cascade.targetTable}`, async (tx) => {
        const result = await executeSingleCascade(tx, cascade, entityIds, brandId);
        affectedRecords[cascade.targetTable] = (affectedRecords[cascade.targetTable] || 0) + result.count;
        return result;
      })
    );
  }

  // Add the main deletion operation
  operations.push(
    createDataOperation(`delete-${sourceTable}`, async (tx) => {
      const result = await executeMainDeletion(tx, sourceTable, entityIds);
      affectedRecords[sourceTable] = result.count;
      return result;
    })
  );

  const transactionResult = await executeTransaction(db, operations, config);

  if (!transactionResult.success) {
    return {
      success: false,
      operations: transactionResult.operations || [],
      affectedRecords: {},
      error: transactionResult.error,
      warnings,
    };
  }

  return {
    success: true,
    operations: transactionResult.operations || [],
    affectedRecords,
    warnings,
  };
}

/**
 * Execute cascading operations for entity updates
 */
export async function executeCascadingUpdate(
  db: Database,
  sourceTable: string,
  entityId: string,
  updateData: Record<string, any>,
  brandId?: string,
  config?: TransactionConfig
): Promise<CascadeOperationResult> {
  const operations: TransactionOperation[] = [];
  const warnings: string[] = [];
  let affectedRecords: { [table: string]: number } = {};

  // Check if any updated fields would affect cascade relationships
  const affectedCascades = CASCADE_DEFINITIONS.filter(def =>
    def.sourceTable === sourceTable && updateData[def.sourceField] !== undefined
  );

  if (affectedCascades.length === 0) {
    // No cascading needed, just do the update
    operations.push(
      createDataOperation(`update-${sourceTable}`, async (tx) => {
        const result = await executeMainUpdate(tx, sourceTable, entityId, updateData);
        affectedRecords[sourceTable] = 1;
        return result;
      })
    );
  } else {
    // Need to handle cascading updates
    operations.push(
      createValidationOperation('validate-cascading-update', async (tx) => {
        // Validate that the update won't break constraints
        for (const cascade of affectedCascades) {
          if (cascade.strategy.validate && cascade.strategy.customValidation) {
            const isValid = await cascade.strategy.customValidation(tx, [entityId]);
            if (!isValid) {
              throw new TRPCError({
                code: 'CONFLICT',
                message: `Update would violate cascade constraint for ${cascade.targetTable}`,
              });
            }
          }
        }
        return true;
      })
    );

    // Handle each cascade
    for (const cascade of affectedCascades) {
      operations.push(
        createDataOperation(`cascade-update-${cascade.targetTable}`, async (tx) => {
          const result = await handleCascadingUpdate(tx, cascade, entityId, updateData, brandId);
          affectedRecords[cascade.targetTable] = (affectedRecords[cascade.targetTable] || 0) + result.count;
          return result;
        })
      );
    }

    // Do the main update
    operations.push(
      createDataOperation(`update-${sourceTable}`, async (tx) => {
        const result = await executeMainUpdate(tx, sourceTable, entityId, updateData);
        affectedRecords[sourceTable] = 1;
        return result;
      })
    );
  }

  const transactionResult = await executeTransaction(db, operations, config);

  if (!transactionResult.success) {
    return {
      success: false,
      operations: transactionResult.operations || [],
      affectedRecords: {},
      error: transactionResult.error,
      warnings,
    };
  }

  return {
    success: true,
    operations: transactionResult.operations || [],
    affectedRecords,
    warnings,
  };
}

// ================================
// HELPER FUNCTIONS
// ================================

/**
 * Execute a single cascade operation
 */
async function executeSingleCascade(
  tx: TransactionContext,
  cascade: CascadeDefinition,
  entityIds: string[],
  brandId?: string
): Promise<{ count: number; details?: any }> {
  const sourceFilter = inArray(getTableColumn(cascade.targetTable, cascade.targetField), entityIds);
  let whereCondition = sourceFilter;

  // Add brand scoping if required
  if (cascade.brandScoped && brandId) {
    const brandColumn = getTableColumn(cascade.targetTable, 'brandId');
    if (brandColumn) {
      whereCondition = and(sourceFilter, eq(brandColumn, brandId));
    }
  }

  switch (cascade.strategy.action) {
    case 'cascade_delete':
      const deleteResult = await tx
        .delete(getTableSchema(cascade.targetTable))
        .where(whereCondition)
        .returning({ id: getTableColumn(cascade.targetTable, 'id') });

      return { count: deleteResult.length };

    case 'set_null':
      const nullField = cascade.targetField;
      const updateResult = await tx
        .update(getTableSchema(cascade.targetTable))
        .set({ [nullField]: null })
        .where(whereCondition)
        .returning({ id: getTableColumn(cascade.targetTable, 'id') });

      return { count: updateResult.length };

    case 'soft_delete':
      const softDeleteResult = await tx
        .update(getTableSchema(cascade.targetTable))
        .set({ deletedAt: new Date().toISOString() })
        .where(whereCondition)
        .returning({ id: getTableColumn(cascade.targetTable, 'id') });

      return { count: softDeleteResult.length };

    case 'prevent':
      // Check if any records exist that would prevent the operation
      const existingRecords = await tx
        .select({ id: getTableColumn(cascade.targetTable, 'id') })
        .from(getTableSchema(cascade.targetTable))
        .where(whereCondition)
        .limit(1);

      if (existingRecords.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: `Cannot proceed: dependent records exist in ${cascade.targetTable}`,
        });
      }

      return { count: 0 };

    default:
      return { count: 0 };
  }
}

/**
 * Execute main deletion operation
 */
async function executeMainDeletion(
  tx: TransactionContext,
  tableName: string,
  entityIds: string[]
): Promise<{ count: number }> {
  const table = getTableSchema(tableName);
  const idColumn = getTableColumn(tableName, 'id');

  const result = await tx
    .delete(table)
    .where(inArray(idColumn, entityIds))
    .returning({ id: idColumn });

  return { count: result.length };
}

/**
 * Execute main update operation
 */
async function executeMainUpdate(
  tx: TransactionContext,
  tableName: string,
  entityId: string,
  updateData: Record<string, any>
): Promise<{ count: number }> {
  const table = getTableSchema(tableName);
  const idColumn = getTableColumn(tableName, 'id');

  const result = await tx
    .update(table)
    .set(updateData)
    .where(eq(idColumn, entityId))
    .returning({ id: idColumn });

  return { count: result.length };
}

/**
 * Handle cascading update operations
 */
async function handleCascadingUpdate(
  tx: TransactionContext,
  cascade: CascadeDefinition,
  entityId: string,
  updateData: Record<string, any>,
  brandId?: string
): Promise<{ count: number }> {
  // This is a simplified implementation
  // In practice, you'd need more complex logic based on what's being updated
  const newValue = updateData[cascade.sourceField];

  if (newValue === null || newValue === undefined) {
    // Source field is being nullified, apply cascade strategy
    return await executeSingleCascade(tx, cascade, [entityId], brandId);
  }

  // For other update types, no cascading needed in this simple implementation
  return { count: 0 };
}

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Get table schema object by name
 */
function getTableSchema(tableName: string): any {
  switch (tableName) {
    case 'brands': return brands;
    case 'products': return products;
    case 'product_variants': return productVariants;
    case 'passports': return passports;
    case 'templates': return templates;
    case 'modules': return modules;
    case 'categories': return categories;
    default:
      throw new Error(`Unknown table: ${tableName}`);
  }
}

/**
 * Get table column by name
 */
function getTableColumn(tableName: string, columnName: string): any {
  const table = getTableSchema(tableName);

  if (!table[columnName]) {
    throw new Error(`Column ${columnName} not found in table ${tableName}`);
  }

  return table[columnName];
}

/**
 * Preview cascade effects without executing them
 */
export async function previewCascadeEffects(
  db: Database,
  sourceTable: string,
  entityIds: string[],
  brandId?: string
): Promise<{
  cascades: Array<{
    targetTable: string;
    action: string;
    estimatedAffectedRecords: number;
  }>;
  warnings: string[];
}> {
  const cascades = CASCADE_DEFINITIONS
    .filter(def => def.sourceTable === sourceTable)
    .sort((a, b) => b.strategy.priority - a.strategy.priority);

  const results = [];
  const warnings: string[] = [];

  for (const cascade of cascades) {
    try {
      const sourceFilter = inArray(getTableColumn(cascade.targetTable, cascade.targetField), entityIds);
      let whereCondition = sourceFilter;

      if (cascade.brandScoped && brandId) {
        const brandColumn = getTableColumn(cascade.targetTable, 'brandId');
        if (brandColumn) {
          whereCondition = and(sourceFilter, eq(brandColumn, brandId));
        }
      }

      const countResult = await db
        .select({ count: count() })
        .from(getTableSchema(cascade.targetTable))
        .where(whereCondition);

      const affectedCount = countResult[0]?.count || 0;

      results.push({
        targetTable: cascade.targetTable,
        action: cascade.strategy.action,
        estimatedAffectedRecords: affectedCount,
      });

      if (affectedCount > 100) {
        warnings.push(`High impact: ${affectedCount} records in ${cascade.targetTable} will be affected`);
      }
    } catch (error) {
      warnings.push(`Could not estimate impact on ${cascade.targetTable}: ${error.message}`);
    }
  }

  return {
    cascades: results,
    warnings,
  };
}

/**
 * Get cascade definition for a specific relationship
 */
export function getCascadeDefinition(
  sourceTable: string,
  targetTable: string
): CascadeDefinition | undefined {
  return CASCADE_DEFINITIONS.find(
    def => def.sourceTable === sourceTable && def.targetTable === targetTable
  );
}

/**
 * Check if a cascade relationship exists
 */
export function hasCascadeRelationship(
  sourceTable: string,
  targetTable: string
): boolean {
  return CASCADE_DEFINITIONS.some(
    def => def.sourceTable === sourceTable && def.targetTable === targetTable
  );
}